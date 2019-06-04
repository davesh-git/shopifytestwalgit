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


const app = express()
const viewPath = path.join(__dirname, '../templates/views')

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

    console.log(chalk.green("Received Call from Shopify"))
    const shopName = 'test-wal-mp'// req.query.shop
    const urlParams = new URLSearchParams(req.query)

    console.log(chalk.yellow('Shopify call:' + req.url))

    //Check if request came from Shopify - validate HMAC
    hmacvalid(urlParams, (resultFlag) => {

        //Request validated from Shopify
        if (resultFlag == 'true') {

            //URL the Shop gets redirected to post installation requests. Note : If a shop logins again after installation, shopify first calls '/' and then gets redirected to '/welcome'
            const firstWelcomeRedirectURL = envVarUtil.envVars.APP_SERV + '/welcome'
            const secondWelcomeRedirectURL = envVarUtil.envVars.APP_SERV + '/homepage'

            const shopScope = shopAccessUtil.shopAccess
            //Randomly Generated value(store it for auth callback to show welcome screen)
            const shopNonce = 1234353590590904
            //Offline (BackEnd tokens) and Online Access both (Front End tokens)
            const shopAccessMode = ''

            let shopsParseObj = ''

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
            //TRUE - Shop DOES NOT exists - Redirect to hopify Install Prompt 
            //FALSE - Shop Exists, and send to /homepage URL

            //STEP 3 
            //If some data is found, then shop may or may not exist
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                //IF SHOP EXISTS at our end
                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {
                    //This is the redirect URL after installation. In the post calls, that is after app installations, this '/' will be called but we might not have to pass all these parameters (check SLDB and change the Params)
                    //Also, when User comes to '/welcome' it should be dynamic content
                    redirectURL = 'https://' + encodeURIComponent(shopName) + '.myshopify.com/admin/oauth/authorize?client_id=' + encodeURIComponent(envVarUtil.envVars.SHOPIFY_API_KEY) +
                        '&scope=' + encodeURIComponent(shopScope) + '&redirect_uri=' + secondWelcomeRedirectURL + '&state=' + shopNonce + '&grant_options[]=' + shopAccessMode
                    consoleStr = 'This is the second time post-installation call'
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


            console.log(consoleStr + ':' + req.url + ',query:' + req.query)
            console.log(chalk.yellow('Redirecting to : ' + redirectURL))

            //Redirect call to shopify
            res.writeHead(301,
                { Location: redirectURL }
            );
            res.end();
            console.log("END OF CALL")

        }

        //Request invalidated - Reject
        else {
            //DO NOTHING or SHOw ERROR WEBPAGE
        }
    })
})

//This is  called after the user has confirmed installation and gets redirected to the welcome screen. 
app.get('/welcome', (req, res) => {

    console.log('Shopify second call from app just after installation' + req.url + ",query:" + req.query)

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

            //After install - if triggered by mistake and shop already exists, show invalid message

            //Some Shop data exists, and specific shop info may or may not exist
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                //IF SHOP EXISTS at our end
                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {
                    shopFoundFlag = true

                    //Shop found and redirect to invalid message as /welcome static message only first time after installation
                    return res.send('Invalid Redirection, please try again')
                }
            }

            //If shop was not found, and this was the first time /welcome call
            if (shopnotfound === true) {
                const shopJSON = [{
                    Shop_Name: 'test-wal-mp'
                }]
                const shopStr = JSON.stringify(shopJSON)
                fs.writeFileSync(shopFilePath, shopStr)

                debugger
                //GET THE PERMANENT TOKEN FOR BACKEND CALLS  (STORE IT IN KEYSTORE DB) -CHECK ALL REQUESTED SCOPES ARE GIVEN (only write ones will be sent back)
                //(shopName, client_id, client_secret, authcode, callback) 
                getTokenUtil.getToken('test-wal-mp', envVarUtil.envVars.SHOPIFY_API_KEY, envVarUtil.envVars.SHOPIFY_SECRET_API_KEY, req.query.code, (response) => {
                    if (response.error !== undefined) {
                        console.log(response.token + ',' + response.scope)
                    }
                    else {
                        console.log(chalk.red(response.error))
                    }

                })

                //Render welcome page
                return res.render('welcome.hbs')
            }
        }
        else {
            //DO NOTHING or SHOw ERROR WEBPAGE
        }

    })
})


//This is called once user opens the installed app and redirected from '/' 
app.get('/homepage', (req, res) => {

    console.log('Shopify second call from app (Already installed)' + req.url + ",query:" + req.query)

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
            let foundFlag = 'false'

            //Shop should definitely exist at this stage
            if (otherUtils.emptyCheck(shopsParseObj) === false) {

                if (shopsParseObj.filter((shop) => shop.Shop_Name === 'test-wal-mp')) {

                    //GET THE ONLINE ACCESS TOKEN FOR UI CALLS AND AUTHENTICATION WHICH USER IS USING THIS APP

                    //Redirect to homepage
                    debugger
                    //GET THE PERMANENT TOKEN FOR BACKEND CALLS  (STORE IT IN KEYSTORE DB) -CHECK ALL REQUESTED SCOPES ARE GIVEN (only write ones will be sent back)
                    //(shopName, client_id, client_secret, authcode, callback) 
                    let tokenCall = getTokenUtil.getToken('test-wal-mp', envVarUtil.envVars.SHOPIFY_API_KEY, envVarUtil.envVars.SHOPIFY_API_SECRET_KEY, req.query.code)
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

app.get('/testpage',(req,res)=>{
    res.send('Test page is working, Thanks')
})

app.listen(3000, () => {
    console.log("Server is runnxing on port 3000")
}) 

//chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:9229/b4111321-4a42-47d0-92b9-525c19c78d5d