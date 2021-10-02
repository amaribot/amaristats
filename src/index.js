require("dotenv").config()
const express = require("express")
const app = express()
const ejs = require("ejs")
const Strategy = require("passport-discord").Strategy
const passport = require("passport")
const config = require("../config")

const amaribotjs = require("amaribot.js")
const AmariBot = new amaribotjs.AmariBot(process.env.AMARIBOT, { debug: true })

app.use(
    require("express-session")({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge: 3600000, //1 hour
        },
    })
)

passport.serializeUser((user, done) => {
    done(null, user)
})

passport.deserializeUser((obj, done) => {
    done(null, obj)
})

passport.use(
    new Strategy(
        {
            clientID: config.clientID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: config.callbackURL,
            scope: config.scope,
        },
        (accessToken, refreshToken, profile, done) => {
            process.nextTick(() => {
                done(null, profile)
                console.log(`New login from ${profile.username}#${profile.discriminator} (${profile.id})`)
            })
        }
    )
)
app.use(express.static(__dirname + "/public"))
app.use(require("cookie-parser")())
app.use(require("body-parser").urlencoded({ extended: true }))
app.use(passport.initialize())
app.use(passport.session())
app.set("view engine", "ejs")

const checkAuth = (req, res, next) => {
    if (req.user) return next()
    res.redirect("/login?return=" + encodeURI(req.path))
}

app.get("/", checkAuth, async (req, res) => {
    let guildIds = req.user.guilds.map((x) => x.id)
    let stats = {}
    let count = 1
    for await (x of guildIds) {
        console.log(count)
        if(count == 50) {
            sleep(60000)
            count = 0
        }
        if (count < 50) {
            let thisStat = {}
            thisStat.user = await AmariBot.getUserLevel(x, req.user.id).catch((x) => (thisStat.user = {}))
            console.log(x, thisStat.user)
            //thisStat.position = await AmariBot.getLeaderboardPosition(x, req.user.id)
            stats[x] = thisStat
        }
        count++
    }
    res.render(__dirname + "/views/index.ejs", { user: req.user, stats })
})

app.get("/login", (req, res) => {
    res.redirect("/auth/discord")
})

app.get("/auth/discord", (req, res) => {
    res.redirect(`https://discord.com/oauth2/authorize?response_type=code&redirect_uri=${encodeURI(config.callbackURL)}&scope=${encodeURI(config.scope)}&client_id=${config.clientID}&prompt=none`)
})

app.get(
    "/auth/callback",
    passport.authenticate("discord", {
        failureRedirect: "/",
    }),
    (req, res) => {
        res.redirect(`/`)
    }
)

app.get("/logout", (req, res) => {
    req.logout()
    res.redirect("/")
})

app.get("/info", checkAuth, (req, res) => {
    res.json(req.user)
})

const listener = app.listen(20202, function () {
    console.log("AmariStats is online, using port " + listener.address().port)
})

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}