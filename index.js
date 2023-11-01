const express = require("express");
const app = express();
var jwt = require('jsonwebtoken');
const cors = require("cors")
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRITE_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.Port || 5000;




// middware
app.use(express.json())
app.use(cors())

// jwt token middware

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

// What's Up packeage 


const uri = "mongodb+srv://bistor_boss:rDE36uVnlIzaQ08k@cluster0.ga6ydds.mongodb.net/?retryWrites=true&w=majority";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    const usersCollection = client.db("bistordb").collection("users");
    const menuCollection = client.db("bistordb").collection("menu");
    const reviewCollection = client.db("bistordb").collection("reviews");
    const cartCollection = client.db("bistordb").collection("carts");
    const paymentCollection = client.db("bistordb").collection("payments");

    // jwt token 

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30day' })

      res.send({ token })
    })


    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    // user relate api ata time  one user Signup but note one way 
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // user verify email er  api 

    app.get('/users/admin/:email',verifyJWT,async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })


    // user update doc admin plane 
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // userr delete function

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })




    // user poser data load 

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)

    })



    // menu related apis
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    // menu post api 

    app.post('/menu',verifyJWT,verifyAdmin, async(req,res)=>{
      const newItem = req.body;
      console.log(newItem);
      const result = await menuCollection.insertOne(newItem)
      res.send(result)

    })
    // menu delete api 
    app.delete('/menu/:id',verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    // review related apis
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // card add post 

    app.post('/carts', async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    // card er post api loaded 
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email
      console.log(email);

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const result = await cartCollection.find().toArray();
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })


    //  // create payment intent
     app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
       

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment method post 

    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const  insertResult = await paymentCollection.insertOne(payment);
      
      const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({insertResult,deleteResult});
    })
    

    //admine status 

    app.get('/admin-stats', verifyJWT,verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
       const orders = await paymentCollection.estimatedDocumentCount();

      // best way to get sum of the price field is to use group and sum operator
      /*
        await paymentCollection.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$price' }
            }
          }
        ]).toArray()
      */

      const payments = await paymentCollection.find().toArray();
       const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)

      res.send({
         revenue,
        users,
         products,
         orders
      })
    })


    // In This  Chart and PaiChart 

    app.get('/order-stats', verifyJWT, verifyAdmin, async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

    })






    // // payment related api
    // app.post('/payments', verifyJWT, async (req, res) => {
    //   const payment = req.body;
    //   const insertResult = await paymentCollection.insertOne(payment);
    //   const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
    //   const deleteResult = await cartCollection.deleteMany(query)
    //   res.send({ insertResult, deleteResult });

    // })

    


    



  }
  finally {




  }

}
run().catch(error => console.log(error))








app.get('/', (req, res) => {
  res.send("Bistro Boos Server running")


})
// user name :bistor_boss
// user password :rDE36uVnlIzaQ08k










app.listen(port, () => {
  console.log(`Bistor Bioss sever${port}`)
})
