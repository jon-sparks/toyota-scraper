const puppeteer = require(`puppeteer`)
const express = require('express')
const { redirect } = require('express/lib/response')
const res = require('express/lib/response')

const app = express()
const port = 8080

async function getData() {

  const url = `https://carfromjapan.com/cheap-used-toyota-for-sale?keywords=gx81&sort=-createdAt&limit=999&minYear=1989&maxYear=1993`

  const browser = await puppeteer.launch({})
  const page = await browser.newPage()

  await page.goto(url)

  const carRows = await page.$$(`.car-row`)

  const cars = await Promise.all(carRows.map(async (row) => {
    const id = await row.$eval(`td:nth-of-type(2) .text-color`, child => child.textContent)
    const model = await row.$eval(`td:nth-of-type(2) h2`, child => child.textContent)
    const year = await row.$eval(`td:nth-of-type(3)`, child => child.textContent.slice(0, 4))
    const mileage = await row.$eval(`td:nth-of-type(4)`, child => child.textContent.slice(0, -2))
    const grade = await row.$eval(`td:nth-of-type(6)`, child => child.textContent.slice(6))
    const price = await row.$eval(`td:nth-of-type(7) strong`, child => child.textContent.slice(4))
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

getData().then(cars => {
  app.get(`/api/cars`, (req, res) => {
    res.send(cars)
  })
})

app.listen(process.env.PORT || port, () => {
  console.log(`Server running on port ${port}`)
})


