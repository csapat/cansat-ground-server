process.stdout.write("\u001b[2J\u001b[0;0H")

const SerialPort = require('serialport')
const colors = require('colors')
const fs = require('fs')
const app = require('express')()
const http = require('http').createServer(app)
const io = require('socket.io')(http)


const config = {}
const readline = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
})

const input = (question)=>{
	return new Promise((resolve, reject)=>{
		readline.question(question+" ", (q)=>resolve(q))
	})
}

/*readline.on("line", () => {
	let dataObj = {
		course: Math.random()*2*Math.PI,
		lat: 2*(Math.random()-0.5)*90,
		lon: 2*(Math.random()-0.5)*90,
		alt: Math.random()*1000,
		temp1: Math.random()*50,
		temp2: Math.random()*50,
		temp3: Math.random()*50,
		acc: {x: Math.random(), y: Math.random(), z: Math.random()},
		mag: {x: Math.random(), y: Math.random(), z: Math.random()},
		gyro: {x: Math.random(), y: Math.random(), z: Math.random()},
		roll: Math.random()*2*Math.PI,
		pitch: Math.random()*2*Math.PI,
		yaw: Math.random()*2*Math.PI,
		pressure: Math.random()*1000000,
		humidity: Math.random(),
		uv: Math.random(),
		loop: Math.random()*5,
		time: new Date().getTime()
	}
	io.emit('data', JSON.stringify(dataObj))
})*/
  
fs.readFileSync('./config.yaml', 'UTF-8').split('\n').map(row=>{
	config[row.split(':')[0]] = row.split(':')[1].trim()
})

const main = async ()=>{

	console.log('ESA CanSat 2020')
	console.log('CSapat'.bold.underline)
	console.log('\n', new Date().toLocaleString(), '\n')

	console.log('Config values:')
	Object.keys(config).map(key=>{
		console.log(' ' + key + ':', config[key])
	})

	console.log('\nAvailable serial ports:')
	serialPortList = await SerialPort.list()

	serialPortList.map((port, i)=>{
		console.log(' ['+(i+1)+'] ', port.path, port.manufacturer)
	})
	let selectedPort
	if (config.port){
		selectedPort = config.port
	} else {
		console.log('\nNo port provided in config.yaml'.bold)
		let selectedValue = await input('Select a port:')
		if (isNaN(Number(selectedValue))) selectedPort = selectedValue
		else selectedPort = serialPortList[Number(selectedValue)-1].path
	}

	console.log('\nSelected port:'.green, selectedPort.green)
	
	let baudRate
	if (config.baudRate) baudRate = Number(config.baudRate)
	else {
		console.log('\nNo baud rate provided in config.yaml'.bold)
		baudRate = Number(await input('Set baud rate:'))
	}
	let port
	console.log('\nBaud rate:'.green, String(baudRate).green, '\n')
	const connectToSerial = (i=0)=>{
		let statusEmitInterval = null
		let manualPortClose = false
		
		port = new SerialPort('\\.\\' + selectedPort, {baudRate})
		port.on('error', (err)=>{	
			if (i) {
				process.stdout.clearLine()
				process.stdout.cursorTo(0)
				process.stdout.write('Attempting to connect to serial port...'.bold)
				process.stdout.write(String(' ('+i+')').bold)
			}
			io.emit('portStatus', {status: 'closed', selectedPort, baudRate})
			if (statusEmitInterval) clearInterval(statusEmitInterval)
			i++
			setTimeout(()=>port.open(), 2000)
		})
		let dataBuffer = ""
		port.on('open', (e)=>{
			i = 0
			console.log('\nConnected to serial port'.green.bold)
			if (statusEmitInterval) clearInterval(statusEmitInterval)
			statusEmitInterval = setInterval(() => {
				io.emit('portStatus', {status: 'open', selectedPort, baudRate})
			}, 2000);
			io.emit('portStatus', {status: 'open', selectedPort, baudRate})	
		})
		port.on('data', (rawData)=>{
			let dr = rawData.toString()
			let d = dr.split('#')
			dataBuffer += d[0]
			if (dataBuffer && dr.indexOf('#')>-1){
				let sd = dataBuffer.split(" ").map(i=>Number(i))
				if (sd.length==23){
					let dataObj = {
						course: sd[0]/100,
						lat: isNaN(sd[1]) ? 0 : sd[1],
						lon: isNaN(sd[2]) ? 0 : sd[2],
						alt: sd[3],
						temp1: sd[4],
						temp2: sd[5],
						temp3: sd[6],
						acc: {x: sd[7], y: sd[8], z: sd[9]},
						mag: {x: sd[10], y: sd[11], z: sd[12]},
						gyro: {x: sd[13], y: sd[14], z: sd[15]},
						roll: sd[16],
						pitch: sd[17],
						yaw: sd[18],
						pressure: sd[19],
						humidity: sd[20],
						uv: sd[21],
						loop: sd[22],
						time: new Date().getTime()
					}
					io.emit('data', JSON.stringify(dataObj))
				} else {
					console.log('Received data with length of', sd.length)
				}
				dataBuffer = d[1]
			}
		})
		port.on('close', (e)=>{
			if (statusEmitInterval) clearInterval(statusEmitInterval)
			if (manualPortClose){
				io.emit('portStatus', {status: 'manual-closed', selectedPort, baudRate})
				statusEmitInterval = setInterval(() => {
					io.emit('portStatus', {status: 'manual-closed', selectedPort, baudRate})
				}, 2000);
			} else {
				console.log('Lost connection to serial port'.red)
				port.open()
			}
		})
		io.on('connection', (socket)=>{
			socket.on("port-close", ()=>{
				manualPortClose = true
				console.log('Port manually disconnected'.bold)
				port.close()
			})
			socket.on("port-open", ()=>{
				manualPortClose = false
				console.log('Port manually opened'.green)
				io.emit('portStatus', {status: null, selectedPort, baudRate})
				if (statusEmitInterval) clearInterval(statusEmitInterval)
				port.open()
			})
		})
	}

	connectToSerial()
	
	app.get('/', (req, res)=>{
		res.send('<h1>Hello world</h1>');
	})

	http.listen(8000, ()=>{})

	io.on('connection', (socket)=>{
		console.log('\nWeb client connected'.green)
	})
	
}

main()