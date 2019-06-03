//To get all the .env file config parameters in process.env
const dotenv = require('dotenv')
dotenv.config()

//const { SHOPIFY_API_SECRET_KEY, SHOPIFY_API_KEY, NODE_ENV} = process.env;

const envVars = process.env

module.exports = {
    envVars
}