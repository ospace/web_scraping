const http = require('http');
const url = require('url');
const querystring = require('querystring'); 
const fs = require('fs');
//const express = require('express');


var server = http.createServer( function(req, res) { 
    console.time('request');
    
    var postRaw = [];
    req
    .on('data', function(data) {
        postRaw.push(data);
    })
    .on('end', function() {
        let postData = ''.concat(postRaw);
        console.log('>> recv:', postData);
        //let postQuery = querystring.parse() 
    })
    .on('error', function(err) {
        console.log('>> error:', err);
    });
    
    var parsedUrl = url.parse(req.url);
    console.log(`>> url[${url}]`);

    var parsedQuery = querystring.parse(parsedUrl.query, '&', '=');
    console.log('>> parsedQuery[',parsedQuery, ']');

    
    //res.writeHead(200,{'Content-Type':'text/html'});
    //res.end('Hello node.js!!');
    
    let reqUrl = req.url;
    if('/' === reqUrl) {
        reqUrl = '/index.html';
    } else if ('/favicon.ico' === reqUrl) {
        return res.writeHead(404);
    }
    
    console.log('>> reqUrl:', reqUrl);
    
    let ext = reqUrl.substr(reqUrl.lastIndexOf('.'));
    switch(ext) {
    case '.jpg':
        res.writeHead(200, {'Content-Type':'image/jpeg'});
        break;
    case '.png':
        res.writeHead(200, {'Content-Type':'image/png'});
        break;
    default:
        res.writeHead(200, {'Content-Type':'text/html'});
        break;
    }
    res.end(fs.readFileSync(__dirname+reqUrl));
    
    console.timeEnd('request');
});

server.listen(8080, function(){
    console.log('Server is running...');
});


function extension(filename) {
    if(!filename) return null;
    return filename.substr(filename.lastIndexOf('.'));
}
// let app = express();

// //정적 페이지 위치:
// //<link rel="stylesheet" type="text/css" href="css/style.css"> 이라고 하면
// // 파일 위치는 static/css/style.css 가 됨.
// app.use(express.static('static'));

// // root에 대한 GET 요청 처리
// app.get('/', function(req, res) {
    // res.writeHead(200,{'Content-Type':'text/html'});
    // res.end('Hello Home!');
// });

// app.listen(8080, function() {
   // console.log('listening 8080 port...');
// });
