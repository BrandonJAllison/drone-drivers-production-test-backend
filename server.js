require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*', // Adjust according to your frontend server for production
}));

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
            success_url: `https://www.app.dronedrivers.com/`
            cancel_url: `https://www.app.dronedrivers.com/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error in creating checkout session:", error);
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
        console.log(res)
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        // Handle post-payment logic here
        console.log('Payment was successful.');
        // Here, you would update the user's payment status in the database
    }

    res.json({received: true});
});

app.listen(port, () => console.log(`Server listening on port ${port}`));