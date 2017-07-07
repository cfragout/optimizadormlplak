var http = require('http');
var fs = require('fs');
var pImage = require('pureimage');
var req = require('request');
var port = process.env.PORT || 8000;
var image;
var images = [];
var ctx;
var siteUrl = 'https://optimizador-mlplak.herokuapp.com/';
var fnt = pImage.registerFont('Calibri.ttf', 'Calibri');
fnt.loadSync();

http.createServer(function(request, response) {
	// console.log('url: ', request.url)
	switch (request.method) {
		case "GET":
			if (request.url === '/') {
				response.writeHead(200, {'Content-Type': 'text/html'});
				response.write('<html><body><h1>Optimizador de corte</h1><div><span>Estado del optimizador: </span><span style="color:green">ONLINE</span></div></body></html>');
			} else {
			}
			break;
		case "POST":
			if (request.url === '/optimizar') {
				var requestBody = '';
				request.on('data', function(data) {
					requestBody += data;
					if (requestBody.length > 1e7) { //10mb
						response.writeHead(413, 'Request Entity Too Large');
						response.end();
					} 
				});

				request.on('end', function(data) {
					var parsedData = JSON.parse(requestBody);
					// del request que me hicieron (POST), creo el request (GET) a placacentro
					var requestUrl = createOptimizerRequestUrl(parsedData);

					// envio request a placacentro
					req(requestUrl, function (error, r, body) {
						var cortes = JSON.parse(body);
						drawOptimization(parsedData.nombreProyecto, parsedData.placa.ancho, parsedData.placa.alto, cortes);

console.log(body);

var res = {
	nombreProyecto: parsedData.nombreProyecto,
	placas: [
		{ imagen: siteUrl + images[0], cubierto: cortes[0].cover} // hacerlo para todas las imagenes
	]
};
response.writeHead(200, {'Content-Type': 'application/json'});
response.write(JSON.stringify(res));
response.end();


					});
				});

			} else {
				response.writeHead(404);
				response.end();
			}

			break;
		case "HEAD":
			break;			
		default:
			response.writeHead(405, 'Method Not Allowed');
			break;
	}
	// response.end();
}).listen(port);

function createOptimizerRequestUrl(jsonRequest) {
	var baseUrl = 'http://www.placacentro.com/optimizador.exe';
	var queryString = '?ancho={ancho}&alto={alto}&hoja={hoja}&minimo={minimo}{pieces}&num={num}';

	queryString = queryString.replace('{ancho}', jsonRequest.placa.ancho);
	queryString = queryString.replace('{alto}', jsonRequest.placa.alto);
	queryString = queryString.replace('{hoja}', jsonRequest.espesorHojaCorte);
	queryString = queryString.replace('{minimo}', jsonRequest.anchoMinimo);
	queryString = queryString.replace('{num}', jsonRequest.piezas.length);

	var pieces = '';

	for (var ii = 0; ii < jsonRequest.piezas.length; ii++) {
		var piece = jsonRequest.piezas[ii];
		var i = ii + 1;
		pieces += '&cantidad_' + i + '=' + piece.cantidad + '&ancho_' + i + '=' + piece.ancho + '&alto_'+ i + '=' + piece.alto + '&rotar_' + i + '=' + piece.rotar;
	}

	queryString = queryString.replace('{pieces}', pieces);

	return baseUrl + queryString;
}

function drawOptimization(name, width, height, cortes) {
	var w = width / 5;
	var h = height / 5;
	for (var i = 0; i < cortes.length; i++) {
		image = pImage.make(w, h);
		ctx = image.getContext('2d');
		drawPageOnCanvas(cortes[i]);
		var imgName = name + '_' + i +'.png';
		pImage.encodePNG(image, fs.createWriteStream(imgName), function(err) {
			if (err) {
				console.log('Error: ', err);
			}
		});
		images.push(imgName);				
	}
}

function drawPageOnCanvas(corte) {
	// dibujo los cortes
	for (var i = 0; i < corte.pieces.length; i++) {
		drawCut(corte.pieces[i], 'white', 'black');
	}

	// dibujo las sobras
	for (var i = 0; i < corte.wastes.length; i++) {
		drawCut(corte.wastes[i], '#8e8989', '#ff0000');
	}

	ctx.stroke();
}

function drawCutBorder(xPos, yPos, width, height, thickness, color) {
	ctx.fillStyle = color;
	ctx.fillRect(xPos - thickness, yPos - thickness, width + (thickness * 2), height + (thickness * 2));
}

function drawCutRect(xPos, yPos, width, height, color, text) {
	ctx.fillStyle = color;
	ctx.fillRect(xPos, yPos, width, height);
}

function drawCenteredText(xPos, yPos, width, height, text) {
	ctx.setFont('Calibri', 15);
	ctx.fillStyle = '#000';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, xPos, yPos)
}

function drawCut(cut, bgColor, borderColor) {
	var h = cut.by - cut.ty;
	var w = cut.bx - cut.tx;
	var text = w + ' X ' + h;
	var width = Math.floor(w / 5);
	var height = Math.floor(h / 5);
	var xPos = Math.floor(cut.tx / 5);
	var yPos = Math.floor(cut.ty / 5);

	drawCutBorder(xPos, yPos, width, height, 1, borderColor);
	drawCutRect(xPos, yPos, width, height, bgColor, text);

	if (h >= 200) { // texto en 3 lineas
		drawCenteredText(xPos + (width / 2) - 10, yPos + (height / 2) + 10, width, height, h.toString());
		drawCenteredText(xPos + (width / 2) - 10, yPos + (height / 2), width, height, '  X');
		drawCenteredText(xPos + (width / 2) - 10, yPos + (height / 2) - 10, width, height, w.toString());
	} else { // texto en 1 linea
		drawCenteredText(xPos + (width / 2) - 10, yPos + (height / 2), width, height, w.toString() + ' X ' + h.toString());
	}
}