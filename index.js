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
    const taskCollection = client.db("PicoWorkersDB").collection('Tasks')
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
      res.clearCookie('token', { ...cookieOption, maxAge: 0 })
        .send({ success: true })
    })

    // User Related Operation
    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        console.log(existingUser);
        return res.send({ message: 'user alredy exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin',
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    app.get('/featuredUsers', async (req, res) => {
      const result = await userCollection
        .find({ role: 'Worker' }).sort({ coin: -1 }).limit(6).toArray();
      res.json(result);
      res.json(result);
    });
    // Data related api
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result)
    })
    // Task related api
    app.post('/tasks', async (req, res) => {
      const newTask = req.body
      const { task_quantity, payable_amount, creator_email } = newTask;
      const totalCost = task_quantity * payable_amount;
      const user = await userCollection.findOne({ email: creator_email });
      const updatedCoin = parseInt(user.coin) - totalCost;
      await userCollection.updateOne({ email: creator_email }, { $set: { coin: updatedCoin } });
      const result = await taskCollection.insertOne(newTask)
      res.send(result)
    })
    app.get('/tasks', async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result)
    })
    app.get('/availableTasks', async (req, res) => {
      const result = await taskCollection.aggregate([
        {
          $addFields: {
            task_quantity_int: { $toInt: "$task_quantity" }
          }
        },
        {
          $match: {
            task_quantity_int: { $gt: 0 }
          }
        },
        {
          $project: {
            task_quantity_int: 0
          }
        }
      ]).toArray();
      res.send(result);
    });
    app.put('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedTask = req.body
      const Task = {
        $set: {
          task_title: updatedTask.task_title,
          task_detail: updatedTask.task_detail,
          submission_info: updatedTask.submission_info,
        }
      }
      const result = await taskCollection.updateOne(filter, Task);
      res.send(result);
    });
    app.delete('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const task = await taskCollection.findOne(query);
      if (task) {
        const { task_quantity, payable_amount, creator_email } = task;
        const totalCost = task_quantity * payable_amount;
        const user = await userCollection.findOne({ email: creator_email });
        if (user) {
          const updatedCoin = parseInt(user.coin) + totalCost;
          await userCollection.updateOne({ email: creator_email }, { $set: { coin: updatedCoin } });
        }
        const result = await taskCollection.deleteOne(query);
        res.send(result)
      }
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