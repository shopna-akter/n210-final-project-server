const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieparser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())
app.use(cookieparser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2yyywnk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = (req, res, next) => {
  console.log('log: info', req.method, req.url);
  next()
}
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token
  if (!token) {
      return res.status(401).send({ message: 'Unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
          return res.status(401).send({ message: 'Unauthorized access' })
      }
      req.user = decoded
      next()
  })
  // next()
}
const cookieOption = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false
}
async function run() {
  try {
    await client.connect();

    const userCollection = client.db("PicoWorkersDB").collection('users')
    const reviewCollection = client.db("PicoWorkersDB").collection('Reviews')
    // auth related api 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
          .cookie('token', token, cookieOption)
          .send({ success: true });
  })
  app.post('/logout', (req, res) => {
      const user = req.body
      res.clearCookie('token', { ...cookieOption , maxAge: 0 })
      .send({ success: true })
  })

    // User Related Operation
    app.post('/users', async(req , res)=>{
        const user = req.body
        const query = {email: user.email}
        const existingUser = await userCollection.findOne(query)
        if (existingUser) {
          console.log(existingUser);
          return res.send({message: 'user alredy exist' , insertedId: null})
        }
        const result = await userCollection.insertOne(user)
        res.send(result)
    })
    app.get('/users', async(req,res)=>{ 
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    app.patch('/users/admin/:id' , async(req , res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          Role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter , updatedDoc);
      res.send(result);
    })
    // Data related api
    app.get('/reviews' , async(req,res)=>{
      const result = await reviewCollection.find().toArray();
      res.send(result)
    })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('PicoWorker server is running to give job')
})
app.listen(port, () => {
    console.log(`PicoWorker is running on port ${port}`);
})