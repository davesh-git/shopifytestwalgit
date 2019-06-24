const express = require('express')
const hbs = require('hbs')
const chalk = require('chalk')
const path = require('path')
const envVarUtil = require('./utils/envars.js')
const otherUtils = require('./utils/otherutils.js')
const shopAccessUtil = require('./constants/shopAccess.js')
const getTokenUtil = require('./utils/gettoken.js')
const fs = require('fs')
const hmacvalid = require('./utils/hmacvalid.js')
const request = require('request')

const app = express()
const viewPath = path.join(__dirname, '../templates/views')

const publicPath = path.join(__dirname, '../public')
app.use(express.static(publicPath))

const shopFilePath = path.join(__dirname, '/shopList.json')
app.set('view engine', 'hbs')
app.set('views', viewPath)

//comment to check commit
debugger
//Default path of the URL
//STEP 1
//Once Shop clicks on install the App, then Shopify will use the redirection URL (that is our base URL) with below params:
//1. Shop 2. HMAC 3. TimeStamp
//We will validate and redirect the SHOP to the next page asking for confirmations (via Shopify) and providing the welcome screen URL
//Once Shop confirms, they will land on Welcome page (whitelisted redirection URL /welome)
app.get('', (req, res) => {
    //STEP 2
    //Validate HMAC - Take the entire string value (Except hmac code) and process through HMAC algo to get hexdigest and match it with hmac value to validate
    console.log(chalk.green("---------------Received Installation Call from Shopify------------------"))
    const shopName = 'test-wal-mp'// req.query.shop
    const urlParams = new URLSearchParams(req.query)

    console.log(chalk.yellow('Shopify call:' + req.url))
    console.log("Shopify full call" + req)

    //Check if request came from Shopify - validate HMAC
    hmacvalid(urlParams, (resultFlag) => {

        //Request validated from Shopify
        if (resultFlag == 'true') {

            //URL the Shop gets redirected to post installation requests. Note : If a shop logins again after installation, shopify first calls '/' and then gets redirected to '/welcome'
            const firstWelcomeRedirectURL = envVarUtil.envVars.APP_SERV + '/welcome'
            const shopScope = shopAccessUtil.shopAccess
            //Randomly Generated value(store it for auth callback to show welcome screen)
            const shopNonce = 1234353590590904
            //Offline (BackEnd tokens) and Online Access both (Front End tokens)
            const shopAccessMode = ''

            let shopsParseObj = ''

            console.log(chalk.green("Parameters initialized"))

            try {
                //Get data to check further if shop exists
                const shopsBuffer = fs.readFileSync(shopFilePath)
                const shopsJSON = shopsBuffer.toString()
                shopsParseObj = JSON.parse(shopsJSON)
                console.log(shopsParseObj)
            }
            catch (e) {
                console.log(chalk.red('File error'))
            }

            let consoleStr = ''
            let redirectURL = ''

            //Default value to send to installation prompt with /welcome URL
            let redirectInstallFlag = true
            //TRUE - Shop DOES NOT exists - Redirect to Shopify Install Prompt 
            //FALSE - Shop Exists, and reject the request

            //STEP 3 
            //If some data is found, then shop may or may not exist
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                //IF SHOP EXISTS at our end - THEN SHOULD NOT BE ENTERTAINED AS CAN BE SECURITY RISK
                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {
                    //This is the redirect URL after installation. In the post calls, that is after app installations, this '/' will be called but we might not have to pass all these parameters (check SLDB and change the Params)
                    //Also, when User comes to '/welcome' it should be dynamic content
                    //  redirectURL = 'https://' + encodeURIComponent(shopName) + '.myshopify.com/admin/oauth/authorize?client_id=' + encodeURIComponent(envVarUtil.envVars.SHOPIFY_API_KEY) +
                    //     '&scope=' + encodeURIComponent(shopScope) + '&redirect_uri=' + secondWelcomeRedirectURL + '&state=' + shopNonce + '&grant_options[]=' + shopAccessMode
                    consoleStr = 'ALERT! -----  Invalid call and security risk. '
                    redirectInstallFlag = false
                }
            }

            //FIRST TIME shop has installed the app, or somehow data does not exist at our end 
            if (redirectInstallFlag === true) {
                //Redirect to Shopify Install Prompt - THIS IS THE FIRST TIME USER HAS NOT INSTALLED THE APP (Check in our DB config - SLDB lookup)
                redirectURL = 'https://' + encodeURIComponent(shopName) + '.myshopify.com/admin/oauth/authorize?client_id=' + encodeURIComponent(envVarUtil.envVars.SHOPIFY_API_KEY) +
                    '&scope=' + encodeURIComponent(shopScope) + '&redirect_uri=' + firstWelcomeRedirectURL + '&state=' + shopNonce + '&grant_options[]=' + shopAccessMode
                consoleStr = 'This is the first time installation call'
            }

            console.log(chalk.green(consoleStr + ':' + req.url + ',query:' + req.query))
            console.log(chalk.yellow('Redirecting to : ' + redirectURL))

            //Redirect call to shopify
            res.writeHead(301,
                { Location: redirectURL }
            );
            res.end();
            console.log(chalk.green('END OF CALL'))

        }

        //Request invalidated - Reject
        else {
            //DO NOTHING or SHOW ERROR WEBPAGE
        }
    })
})

//This is  called after the user has confirmed installation and gets redirected to the welcome screen. At this stage we will fetch the tokens and persist in our DB i.e Appvault
app.get('/welcome', (req, res) => {

    console.log(chalk.green('------------------------Shopify second call from app just after installation' + req.url + ",query:" + req.query + '----------------------'))

    //STEP 4 VALIDATE
    // The nonce is the same one that your app provided to Shopify during step two (to make suree this was redirected call from '/')
    // The hmac is valid. The HMAC is signed by Shopify as explained below, in Verification.
    // The hostname parameter is a valid hostname, ends with myshopify.com, and does not contain characters other than letters (a-z), numbers (0-9), dots, and hyphens.
    const urlParams = new URLSearchParams(req.query)

    //Check if request came from Shopify - validate HMAC
    hmacvalid(urlParams, (resultFlag) => {
        //Request validated from Shopify
        if (resultFlag == 'true') {
            let shopsParseObj = ''
            //Get data to check further if shop exists
            try {
                //Get data to check further if shop exists
                const shopsBuffer = fs.readFileSync(shopFilePath)
                const shopsJSON = shopsBuffer.toString()
                shopsParseObj = JSON.parse(shopsJSON)
            }
            catch (e) {
                console.log(chalk.red('File error'))
            }

            let consoleStr = ''
            let shopFoundFlag = true

            //Validate Nonce code
            const nonce2 = req.query.state
            console.log(chalk.red(nonce2))
            if (nonce2 == 1234353590590904) {
                console.log(chalk.green('Nonce validated!!!'))
            }
            else {
                console.log(chalk.red('ALERT! - NONCE INVALID'))
            }


            //After install - if triggered by mistake and shop already exists, show invalid message

            //Some Shop data exists, and specific shop info may or may not exist
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                //IF SHOP EXISTS at our end
                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {
                    shopFoundFlag = true

                    console.log(chalk.red('ALERT! - This call is not possible and RISK'))
                    //Shop found and redirect to invalid message as /welcome static message only first time after installation
                    return res.send('Invalid Redirection, please try again')
                }
            }

            //If shop was not found, and this was the valid first time /welcome call
            if (shopFoundFlag === true) {
                const shopJSON = [{
                    Shop_Name: 'test-wal-mp'
                }]
                console.log(chalk.green('Adding to DB that partner has installed the app'))
                const shopStr = JSON.stringify(shopJSON)
                fs.writeFileSync(shopFilePath, shopStr)

                console.log(chalk.green("Shop details:" + shopStr))
                debugger

                //GET THE PERMANENT TOKEN FOR BACKEND CALLS  (STORE IT IN KEYSTORE DB) -CHECK ALL REQUESTED SCOPES ARE GIVEN (only write ones will be sent back)
                //(shopName, client_id, client_secret, authcode, callback) 
                let tokenCall = getTokenUtil.getToken('test-wal-mp', envVarUtil.envVars.SHOPIFY_API_KEY, envVarUtil.envVars.SHOPIFY_SECRET_API_KEY, req.query.code)
                tokenCall.then((response) => {
                    console.log(chalk.yellow('Token' + response.token + ',' + response.scope))
                }, (error) => {
                    console.log(chalk.red(response.error))
                })

                // //GET THE PERMANENT TOKEN FOR BACKEND CALLS  (STORE IT IN KEYSTORE DB) -CHECK ALL REQUESTED SCOPES ARE GIVEN (only write ones will be sent back)
                // //(shopName, client_id, client_secret, authcode, callback) 
                // getTokenUtil.getToken('test-wal-mp', envVarUtil.envVars.SHOPIFY_API_KEY, envVarUtil.envVars.SHOPIFY_SECRET_API_KEY, req.query.code, (response) => {

                //     console.log(chalk.green('Call to Shopify to fetch API token'))

                //     if (response.error !== undefined) {
                //         console.log(chalk.yellow(response.token + ',' + response.scope))

                //         //SAVE THE TOKEN IN DB
                //     }
                //     else {
                //         console.log(chalk.red(response.error))
                //     }

                //})

                //Render welcome page
                return res.render('welcome.hbs')
            }
        }
        else {
            //DO NOTHING or SHOW ERROR WEBPAGE
        }

    })
})


//This is called once user opens the installed app and first navigation link
app.get('/homepage', (req, res) => {
    console.log(chalk.green('-----------------Shopify Home page request from app (Already installed)' + req.url + ",query:" + req.query + '-------------------'))

    console.log(chalk.yellow('URL called should have nonce:' + req.query.url))

    //STEP 4 VALIDATE
    // The hmac is valid. The HMAC is signed by Shopify as explained below, in Verification.
    // The hostname parameter is a valid hostname, ends with myshopify.com, and does not contain characters other than letters (a-z), numbers (0-9), dots, and hyphens.
    const urlParams = new URLSearchParams(req.query)

    //Check if request came from Shopify - validate HMAC
    hmacvalid(urlParams, (resultFlag) => {
        //Request validated from Shopify
        if (resultFlag == 'true') {
            let shopsParseObj = ''
            //Get data to check further if shop exists

            try {
                const shopsBuffer = fs.readFileSync(shopFilePath)
                console.log("Shop Buffer :" + shopsBuffer)
                const shopsJSON = shopsBuffer.toString()
                console.log("Shop JSON :" + shopsJSON)
                shopsParseObj = JSON.parse(shopsJSON)
                console.log("Shop Obj:" + shopsParseObj[0])
            }
            catch (e) {
                console.log(chalk.red('File error' + e))
            }

            let consoleStr = ''
            let foundFlag = 'false'

            //Shop should definitely exist at this stage
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {

                    //GET THE ONLINE ACCESS TOKEN FOR UI CALLS AND AUTHENTICATION WHICH USER IS USING THIS APP (This should only happen if token fetch during welcome page failed)

                    //Redirect to homepage
                    debugger
                    //-----IF TOKEN DOES NOT EXIST ALREADY---s)
                    //GET THE PERMANENT TOKEN FOR BACKEND CALLS  (STORE IT IN KEYSTORE DB) -CHECK ALL REQUESTED SCOPES ARE GIVEN (only write ones will be sent back)
                    //(shopName, client_id, client_secret, authcode, callback) 
                    let tokenCall = getTokenUtil.getToken('test-wal-mp', envVarUtil.envVars.SHOPIFY_API_KEY, envVarUtil.envVars.SHOPIFY_SECRET_API_KEY, req.query.code)
                    tokenCall.then((response) => {
                        console.log(response.token + ',' + response.scope)
                    }, (error) => {
                        console.log(chalk.red(response.error))
                    })

                    return res.render('homepage.hbs')
                }

                else {
                    return res.send('your Shop not found, please try again')
                }
            }
        }
        else {
            //DO NOTHING or SHOw ERROR WEBPAGE
        }

    })


})

app.get('/syncproducts', (req, res) => {

    const url = 'https://shopifywalbackend.herokuapp.com/backend/syncproducts'
    request({ url: url }, (error, response) => {
        if (error) {

        }
        else if (response) {
            const data = response.body
            console.log(data)
            return res.send(response.body)
        }
    })
})


app.get('/manageproducts', (req, res) => {

    console.log('Headers'+JSON.stringify(req.headers))
    console.log('Request payload' + JSON.stringify(req.body))
    console.log('Request url' + req.url)
    console.log('Full Request:'+JSON.stringify(req))


    return res.render('product.hbs')

    //STEP 4 VALIDATE
    // The nonce is the same one that your app provided to Shopify during step two (to make suree this was redirected call from '/')
    // The hmac is valid. The HMAC is signed by Shopify as explained below, in Verification.
    // The hostname parameter is a valid hostname, ends with myshopify.com, and does not contain characters other than letters (a-z), numbers (0-9), dots, and hyphens.
    const urlParams = new URLSearchParams(req.query)

    //Check if request came from Shopify - validate HMAC
    hmacvalid(urlParams, (resultFlag) => {
        //Request validated from Shopify
        if (resultFlag == 'true') {
            let shopsParseObj = ''
            //Get data to check further if shop exists

            try {
                const shopsBuffer = fs.readFileSync(shopFilePath)
                console.log("Shop Buffer :" + shopsBuffer)
                const shopsJSON = shopsBuffer.toString()
                console.log("Shop JSON :" + shopsJSON)
                shopsParseObj = JSON.parse(shopsJSON)
                console.log("Shop Obj:" + shopsParseObj[0])
            }
            catch (e) {
                console.log(chalk.red('File error' + e))
            }

            let consoleStr = ''
            let foundFlag = 'false'

            //Shop should definitely exist at this stage
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {

                    return res.render('product.hbs')
                }

                else {
                    return res.send('your Shop not found, please try again')
                }
            }
        }
        else {
            //DO NOTHING or SHOw ERROR WEBPAGE
        }

    })
})

app.post('/webhook/productupdate', (req, res) => {
    console.log('Headers'+req.headers)
    console.log('Request from Shopify Webhook:' + req)
    console.log('Request payload' + req.body)
    console.log('Request url' + req.url)
    console.log('Full Request:'+req)
})

app.listen(process.env.PORT || 3000), () => {
    console.log("Server is runnxing on port 3000")
}


//chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:9229/b4111321-4a42-47d0-92b9-525c19c78d5d
//curl -X GET -H "X-Shopify-Access-Token: a12070de2fb759429529f8d14db10be2" "https://test-wal-mp.myshopify.com/admin/api/2019-04/product_listings.json"

//https://test-wal-mp.myshopify.com/admin/bulk?resource_name=Product&edit=metafields.walmart.taxcode:string,metafields.walmart.gtin:string,metafields.walmart.checkflag:boolean,metafields.walmart.category:select,clothing,electronics,metafield.walmart.size:string.metafield.walmart.color:string,variants.sku&metafield_options[metafields.walmart.category][1]=clothing&metafield_options[metafields.walmart.category][2]=Electronics&metafield_options[metafields.walmart.category][3]=Tires
