
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const fs = require('fs');
const app = express();

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*', // Adjust according to your frontend server for production
}));


const caCertificatePath = path.join(__dirname, 'ca-certificate.crt');
const caCertificate = fs.readFileSync(caCertificatePath).toString();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Your database connection string
  ssl: {
    rejectUnauthorized: false, // This ensures that the certificate is verified
    ca: caCertificate // Provide the CA certificate for verification
  }
});
const port = process.env.PORT || 3001;

app.post('/api/create-checkout-session', async (req, res) => {
    // Hardcoded user ID and email for testing
    const userId = 'testUserId';
    const userEmail = 'testUserEmail@example.com';

    try {
        // Step 1: Insert or update user in your database with hardcoded values
        const userInsertOrUpdateQuery = `
            INSERT INTO users (id, email) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
            RETURNING *;
        `;
        const userResult = await pool.query(userInsertOrUpdateQuery, [userId, userEmail]);
        console.log('User inserted or updated:', userResult.rows[0]);

        // Step 2: Proceed to create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Drone Drivers Part 107 Test Prep Course',
                    },
                    unit_amount: 13900, // Price in cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://www.app.dronedriver.com/success`,
            cancel_url: `https://www.app.dronedriver.com/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Route for creating a Stripe checkout session
// app.post('/api/create-checkout-session', async (req, res) => {
//     try {
//         // Create Stripe Checkout session
//         const session = await stripe.checkout.sessions.create({
//             payment_method_types: ['card'],
//             line_items: [{
//                 price_data: {
//                     currency: 'usd',
//                     product_data: {
//                         name: 'Drone Drivers Part 107 Test Prep Course',
//                     },
//                     unit_amount: 13900, // Price in cents
//                 },
//                 quantity: 1,
//             }],
//             mode: 'payment',
//             success_url: `https://www.app.dronedriver.com/success`,
//             cancel_url: `https://www.app.dronedriver.com/cancel`,
//         });

//         res.json({ id: session.id });
//     } catch (error) {
//         console.error("Error in creating checkout session:", error);
//         res.status(500).json({ error: error.message });
//     }
// });


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
            // Hardcoded user_id and course_id for testing
            const hardcodedUserId = '123'; // Example user ID
            const hardcodedCourseId = '107'; // Example course ID, assuming this doesn't change
            const text = 'INSERT INTO course_purchases(user_id, course_id, session_id, amount_paid) VALUES($1, $2, $3, $4) RETURNING *';
            const values = [
                hardcodedUserId, // Use hardcoded user ID
                hardcodedCourseId, // Use hardcoded course ID
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

// app.post('/wh-stripe', express.raw({type: 'application/json'}), (req, res) => {
//     console.log('Webhook received:', req.body);
//     res.status(200).send('OK');
// });

app.listen(port, () => console.log(`Server listening on port ${port}`));