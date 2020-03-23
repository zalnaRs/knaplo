let api = require("./api.js");

const http = require("http");
const fs = require("fs");

const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3001;

const crypto = require('crypto');

function getLastCommit(){
    function run(command){
        return require('child_process').execSync(command).toString().trim()
    }
    
    return {
        hash:run("git rev-parse HEAD"),
        time:run(`git log -1 --format="%at"`),
    };
}
let lastcommit = getLastCommit();
console.log("Running "+lastcommit.hash);

app.use(cookieParser());


let enc_dec_secret;
if (!fs.existsSync("secret")){
    var token = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync("secret",token);

    enc_dec_secret = token;
} else {
    enc_dec_secret = fs.readFileSync("secret");
}


function encrypt(data){
    let secret = enc_dec_secret;
    var key = crypto.createCipher('aes-128-cbc', secret);
    var str = key.update(data, 'utf8', 'hex')
    str += key.final('hex');
    return str;
}
function decrypt(data){
    let secret = enc_dec_secret;

    try {
        var key = crypto.createDecipher('aes-128-cbc', secret);
        var str = key.update(data, 'hex', 'utf8')
        str += key.final('utf8');
        return str;
    } catch(err){
        throw err;
    }
}
{// encryption decryption test
    let start = Date.now();
    let original = "test";
    console.log("Original string: ",{s:original});
    let enc = encrypt(original);
    console.log("Encrypted string: ",{s:enc});
    let dec = decrypt(enc);
    console.log("Decrypted string: ",{s:dec});
    console.log("Matches original: ",original == dec);
    console.log("Took: ",Date.now()- start);
}

function refresh(req,res,setcookie){
    return new Promise(async function(resolve,reject){

    
        let result = await api.refresh(req.cookies["inst"],req.cookies["refresh_token"])
        

        if (result == "error"){
            //console.log("Refresh token failed, trying password");


            let _return = false;
            //try logging in again
            let password;
            try {
                password = decrypt(req.cookies["password_encrypted"]);
            } catch(err){
                //console.log("Failed to decrypt password",err);
                resolve(false);
                return;
            }

            
            api.login(req.cookies["inst"],req.cookies["username"],password)
            .catch((error)=>{
                //console.log("Password failed");

                let options = {expires: new Date(0)};
                setcookie("access_token","", options);
                setcookie("refresh_token","", options);    
                setcookie("inst","", options);
                setcookie("username","", options);
                setcookie("password_encrypted","", options);

                
                res.send();

                resolve(false);
            })
            .then( (result) => {
                //console.log("Password auth successful");

                let options = {maxAge: 1000*60*60*24*30*365};

                setcookie("access_token",result.access_token, options);
                setcookie("refresh_token",result.refresh_token, options);
                setcookie("time",Date.now(), options);

                resolve(true);
            });

            
            
            
        } else {
            //console.log("Token auth successfull");

            let options = {maxAge: 1000*60*60*24*30*365};

            //console.log("token",result.access_token);

            setcookie("access_token",result.access_token, options);
            setcookie("refresh_token",result.refresh_token, options);
            setcookie("time",Date.now(), options);

            resolve(true);
        }

        

    });
}

app.all('/**',async (req, res, next) => {
    

    
    if (req.cookies["access_token"] && req.cookies["inst"] && req.cookies["refresh_token"]){
        console.log("Refreshing auth");        

        let setcookie = function(cookie_name,value){
            req.cookies[cookie_name] = value;

            res.cookie(...arguments);
        }

        let ref = await refresh(req,res,setcookie);
        console.log("Refresh: "+ref);

        
    }    

    next();
    
});
app.all('/health',async (req, res) => {
    let resp = {
        time:Date.now(),
        timeZoneOffset:(new Date()).getTimezoneOffset()
    };
    res.send(JSON.stringify(resp));
});
app.all('/inst_full',async (req, res) => {
    res.sendFile(__dirname+"/institute.json");
});
app.all('/institute',async (req, res) => {
    res.sendFile(__dirname+"/inst_clean.json");
});

/* app.all('/data',async (req, res) => {
    let school = req.cookies["inst"];
    let token = req.cookies["access_token"];

    api.pipeData(school,token,res);
}); */
app.all('/data',async (req, res) => {
    let school = req.cookies["inst"];
    let token = req.cookies["access_token"];

    let data = await api.studentAmi(school, token);
    res.send(data);
    /* api.getData(school,token).then((data)=>{
        res.send(data);
    }).catch((err)=>{
        res.status(500);
        res.send("error");
    }) */
});
app.all('/lastcommit',async (req, res) => {
    res.send(JSON.stringify(lastcommit));
});
app.all('/login',async (req, res) => {
     
    let needs = {
        inst:"Intézményt",
        username:"Felhasználónevet",
        password:"Jelszót"
    };

    function loginError(message){
        console.log(message);

        res.statusCode = "500";
        res.send(message);

    }


    for (let p in needs){
        if (req.query.username){
            req.query.username = req.query.username.toString().replace(/\+/g," ").trim()
        }
        

        if (req.query[p] == undefined
          || req.query[p] == ""
          || req.query[p] == null){

            loginError("Nem adott meg "+needs[p]);
            return;
        }
    }
    

    api.login(req.query.inst,req.query.username,req.query.password)
    .catch((error)=>{
        loginError(error);
    })
    .then( (result) => {
        console.log(result);
        if (result.error){
            console.log(result.error);
            loginError(result.error.error_description);
            return;
        } else {
            let options = {maxAge: 1000*60*60*24*30*365};
            let info = {
                "access_token":result.access_token,
                "refresh_token":result.refresh_token,
                "inst":req.query.inst,
                "password_encrypted":encrypt(req.query.password),
                "username":req.query.username
            }
            res.cookie("loginInfo",JSON.stringify(info), options);
            
            res.send(info);

        }
    })
});

app.listen(port);

console.log("Server started");