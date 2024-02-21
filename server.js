require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*', // Adjust according to your frontend server
}));

const client = jwksClient({
  jwksUri: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_6qILSZXQa/.well-known/jwks.json`
});

function getKey(header, callback){
  client.getSigningKey(header.kid, function(err, key) {
    var signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(" ")[1]; // Bearer <token>
    if (!token) return res.status(403).send("A token is required for authentication");

    jwt.verify(token, getKey, { algorithms: ['RS256'] }, function(err, decoded) {
        if(err) {
            console.log(err);
            return res.status(401).send("Invalid Token");
        }
        req.user = decoded;
        next();
    });
};

const port = process.env.PORT || 3001;

// Route for creating a Stripe checkout session and inserting/updating the user in the database
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
    const { email, userId } = req.body; // Received from the frontend

    try {
        // Insert or update user in the database
        await pool.query(
            'INSERT INTO users (id, email, paid) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, paid = EXCLUDED.paid;',
            [userId, email, false]
        );

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Drone Drivers Part 107 Course',
                    },
                    unit_amount: 13900, // Price in cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://app.dronedrivers.com/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://app.dronedrivers.com/cancel`,
            metadata: {
                userId: userId, // Pass userId to Stripe for reference
            },
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error in creating checkout session or inserting user:", error);
        res.status(500).json({ error: error.message });
    }
});

// Stripe webhook endpoint for handling events
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId; // Retrieve userId from session metadata

        // Update user's paid status in the database
        await pool.query('UPDATE users SET paid = $1 WHERE id = $2', [true, userId]);
    }

    res.json({received: true});
});

app.listen(port, () => console.log(`Server listening on port ${port}`));