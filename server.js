
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


const caCertificatePath = './ca-certificate.crt';
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
    console.log('Received payload:', req.body); // Log the body
    
    // Correctly assigning a hardcoded dummy userID
    const userID = 'dummyUserID-12345';

    console.log('Using hardcoded userID:', userID);

    try {
        // Assuming you have already connected to your database and have the `pool` variable set up correctly
        const userInsertOrUpdateQuery = `
            INSERT INTO course_purchases(user_id) VALUES ($1)
        `;
        // Execute the query with the hardcoded userID
        const userResult = await pool.query(userInsertOrUpdateQuery, [userID]);
        console.log('User inserted or updated in course_purchases:', userResult);

        // Proceed to create Stripe Checkout session with the hardcoded userID
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
            metadata: { userID }, // Pass the hardcoded userID in metadata for tracking
            success_url: `https://www.app.dronedriver.com/success`,
            cancel_url: `https://www.app.dronedriver.com/cancel`,
        });

        // Respond with the session ID
        res.json({ id: session.id });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// app.post('/api/create-checkout-session', async (req, res) => {
//     const { userID, userEmail } = req.body; // Assume these are passed from the frontend

//     try {
//         // Step 1: Insert or update user in your database
//         // Modify your query to use the userID for insert/update operation
//         const userInsertOrUpdateQuery = `
//             INSERT INTO course_purchases (user_id, email) VALUES ($1, $2)
//             ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
//         `;
//         const userResult = await pool.query(userInsertOrUpdateQuery, [userID, userEmail]);
//         console.log('User inserted or updated:', userResult.rows[0]);

//         // Step 2: Proceed to create Stripe Checkout session with metadata
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
//             metadata: { userID }, // Include userID in session metadata for later reference
//             success_url: `https://www.app.dronedriver.com/success`,
//             cancel_url: `https://www.app.dronedriver.com/`,
//         });

//         res.json({ id: session.id });
//     } catch (error) {
//         console.error("Error Creating Stripe Checkout:", error);
//         res.status(500).json({ error: error.message });
//     }
// });




app.get('/api/user/:userId', async (req, res) => {
    // res.json({ message: "Route hit successfully" });
    const { userId } = req.params;
    console.log("Received userID:", userId); // Confirming userID is received
    
    try {
        const query = `
            SELECT * FROM course_purchases
            WHERE user_id = $1;
        `;
        const { rows } = await pool.query(query, [userId]);

        console.log(rows); // Log the query result to see what's being returned
        res.json({ message: "Query executed successfully", data: rows });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Internal server error detected", details: error.message });
    }
});


// app.post('/wh-stripe', express.raw({type: 'application/json'}), async (req, res) => {
//     try {
//         // Assuming you've verified the webhook signature and parsed the event
//         const event = JSON.parse(req.body);

//         // For demonstration, let's say we react to a specific event type
//         if (event.type === 'checkout.session.completed') {
//             // Define the test email and any other info you want to insert
//             const testEmail = "webhook@example.com";

//             // SQL query to insert a new user
//             const queryText = 'INSERT INTO course_purchases(email) VALUES($1) RETURNING *';
//             const values = [testEmail];

//             try {
//                 const dbRes = await pool.query(queryText, values);
//                 console.log('New user created:', dbRes.rows[0]);
//                 // Respond to the webhook event
//                 res.json({received: true});
//             } catch (dbErr) {
//                 console.error('Database error:', dbErr);
//                 res.status(500).json({error: 'Internal server error'});
//             }
//         } else {
//             // Handle other event types or ignore them
//             res.json({received: true});
//         }
//     } catch (err) {
//         console.error('Webhook handling error:', err);
//         res.status(400).send(`Webhook Error: ${err.message}`);
//     }
// });

app.post('/api/test', (req, res) => {
    console.log('Received the followingpayload:', req.body); // Log the received payload
    res.status(200).json({ message: 'Payload received successfully', receivedPayload: req.body });

    try {
        // Assuming you have already connected to your database and have the `pool` variable set up correctly
        const userInsertOrUpdateQuery = `
            INSERT INTO course_purchases(user_id) VALUES ($1)
        `;
        // Execute the query with the hardcoded userID
        const userResult = await pool.query(userInsertOrUpdateQuery, [userID]);
        console.log('User inserted or updated in course_purchases:', userResult);
  });


  app.post('/wh-stripe', express.raw({type: 'application/json'}), async (req, res) => {
    console.log('Received webhook event:');
    try {
        const event = JSON.parse(req.body);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object; // The checkout session object
            const userID = session.metadata.userID; // Retrieve userID from metadata
            const userEmail = session.customer_email; // Customer's email address
            const amountPaid = session.amount_total; // Total amount paid
            const sessionID = session.id; // Checkout session ID
            const courseID = 'FAA107'; // Course ID hardcoded as 'FAA107'
            const hasPaid = true; // Since the checkout was completed successfully

            console.log(session.metadata);

            // SQL query to insert or update the user's purchase record
            const queryText = `
                INSERT INTO course_purchases (user_id, email, amount_paid, session_id, course_id, has_paid)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    amount_paid = EXCLUDED.amount_paid,
                    session_id = EXCLUDED.session_id,
                    course_id = EXCLUDED.course_id,
                    has_paid = EXCLUDED.has_paid
                RETURNING *;
            `;
            // Correctly defining the values array once
            const values = [userID, userEmail, amountPaid, sessionID, courseID, hasPaid];

            try {
                const dbRes = await pool.query(queryText, values);
                console.log('User purchase record created or updated from webhook:', dbRes.rows[0]);
                res.json({received: true});
            } catch (dbErr) {
                console.error('Database error:', dbErr);
                res.status(500).json({error: 'Internal server error'});
            }
        } else {
            res.json({received: true});
        }
    } catch (err) {
        console.error('Webhook handling error:', err);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

app.listen(port, () => console.log(`Server listening on port ${port}`));