
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
    const { userID } = req.body; // Extract userID from the request body

    try {
        // Assuming you have already connected to your database and have the `pool` variable set up correctly
        // Updated query to insert user_id and set has_paid to true by default
        const userInsertOrUpdateQuery = `
            INSERT INTO course_purchases(user_id, has_paid) VALUES ($1, true)
        `;
        // Execute the query with the userID passed from the frontend
        const userResult = await pool.query(userInsertOrUpdateQuery, [userID]);
        console.log('User inserted or updated in course_purchases:', userResult);

        // Proceed to create Stripe Checkout session, passing the userID in metadata for tracking
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
            metadata: { userID }, // Pass the userID in metadata for tracking
            success_url: `https://www.app.dronedriver.com/success`,
            cancel_url: `https://www.app.dronedriver.com/`,
        });

        // Respond with the session ID
        res.json({ id: session.id });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// app.post('/wh-stripe', express.raw({type: 'application/json'}), async (req, res) => {
//     console.log()
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


app.listen(port, () => console.log(`Server listening on port ${port}`));