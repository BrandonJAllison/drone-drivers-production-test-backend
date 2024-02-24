
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*', // Adjust according to your frontend server for production
}));

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Ensure this is set in your .env file
    ssl: {
        rejectUnauthorized: true
    }
});

const port = process.env.PORT || 3001;

// Route for creating a Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
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
            success_url: `https://www.app.dronedriver.com/`,
            cancel_url: `https://www.app.dronedriver.com/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error in creating checkout session:", error);
        res.status(500).json({ error: error.message });
    }
});

// Stripe webhook endpoint for handling events
app.post('/wh-stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Asynchronous function to handle the event
    const handleEvent = async (event) => {
        if (event.type === 'checkout.session.completed') {
            console.log('Payment was successful.');

            const session = event.data.object; // Contains all the session information
            const text = 'INSERT INTO course_purchases(user_id, course_id, session_id, amount_paid) VALUES($1, $2, $3, $4) RETURNING *';
            const values = [
                session.client_reference_id, // Assuming client_reference_id is used to pass the user ID
                '107', // Adjust with actual course ID as needed
                session.id,
                session.amount_total
            ];

            try {
                const dbRes = await pool.query(text, values);
                console.log(dbRes.rows[0]); // Log the inserted purchase
            } catch (err) {
                console.error('Error saving purchase to database:', err);
            }
        }
    };

    // Call handleEvent and await its completion
    await handleEvent(event).catch(err => console.error('Event handling error:', err));

    res.json({received: true});
});

app.listen(port, () => console.log(`Server listening on port ${port}`));