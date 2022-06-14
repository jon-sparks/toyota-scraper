const puppeteer = require(`puppeteer`)
const express = require('express')

var cron = require('node-cron')
var format = require('pg-format')

const { Pool } = require('pg')

const pool = new Pool({
  ssl: {
    rejectUnauthorized: false,
  }
})

const app = express()
const port = 8080

const getCarIds = async () => pool.query(`SELECT car_id FROM cars`)

const insertCars = data => {
  const query = format(`INSERT INTO cars(car_id, model, year, mileage, grade, price, url, date) VALUES %L`, Object.values(data))

  return pool.query(query)
}

const getCars = async () => pool.query(`SELECT * FROM cars ORDER BY price DESC`)

async function getData() {

  const url = `https://carfromjapan.com/cheap-used-toyota-for-sale?keywords=gx81&sort=-createdAt&limit=999&minYear=1988&maxYear=1993`

  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  })
  const page = await browser.newPage()

  await page.goto(url)

  const carRows = await page.$$(`.car-row`)

  const cars = await Promise.all(carRows.map(async (row) => {
    const id = await row.$eval(`td:nth-of-type(2) .text-color`, child => child.textContent)
    const model = await row.$eval(`td:nth-of-type(2) h2`, child => child.textContent)
    const year = await row.$eval(`td:nth-of-type(3)`, child => child.textContent.slice(0, 4))
    const mileage = await row.$eval(`td:nth-of-type(4)`, child => child.textContent.slice(0, -2).replace(`,`, ``))
    const grade = await row.$eval(`td:nth-of-type(6)`, child => child.textContent.slice(6))
    const price = await row.$eval(`td:nth-of-type(7) strong`, child => child.textContent.slice(4).replace(`,`, ``))
    const url = await row.$eval(`td:nth-of-type(1)`, child => child.querySelector(`a`).href)
    const dateScraped = new Date().toISOString()
    return await {
      id,
      model,
      year,
      mileage,
      grade,
      price,
      url,
      dateScraped
    }
  }))

  await browser.close()
  return cars
  
}

cron.schedule('0 0 * * *', () => {
  console.log('running a task at midnight every day')
  getCarIds().then(ids => {
    console.log(`Processing...`)
    const idsArray = ids.rows.map(id => id.car_id)
    getData().then(cars => {
      const formattedCars = cars.map(car => {
        return Object.values(car)
      })
      const filteredCars = formattedCars.filter(car => {
        return !idsArray.includes(car[0])
      })
      if (filteredCars.length) {
        console.log(`Adding ${filteredCars.length} cars to DB...`)
        insertCars(filteredCars)
      }
      console.log(`No new cars to add`)
    }).then(() => console.log(`Done`))
  })
});


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


