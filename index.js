const express = require('express')

var cors = require('cors')

const app = express()
const port = 8080

app.use(cors());

const { Pool } = require('pg')

const pool = new Pool({
  ssl: {
    rejectUnauthorized: false,
  }
})

const getCars = async () => pool.query(`SELECT * FROM cars ORDER BY price DESC`)

app.get(`/`, async (req, res) => {
  res.send(`<h1>GX81 API</h1>`)
})

app.get(`/api/cars`, (req, res) => {
  getCars().then(cars => {
    res.send(cars.rows)
  })
})

app.listen(process.env.PORT || port, () => {
  console.log(`Server running on port ${port}`)
})


