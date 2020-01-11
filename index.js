process.stdout.write("\u001b[2J\u001b[0;0H")

const SerialPort = require('serialport')
const colors = require('colors')
const fs = require('fs')
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

	console.log('\nBaud rate:'.green, String(baudRate).green, '\n')

	const port = new SerialPort('\\.\\' + selectedPort, {baudRate})
	port.on('error', (err)=>{
		console.log(String(err).red)
	})
	let dataBuffer = ""
	port.on('data', (rawData)=>{
		let dr = rawData.toString()
		let d = dr.split('#')
		dataBuffer += d[0]
		if (dataBuffer && dr.indexOf('#')!==-1){
			process.stdout.clearLine()
			process.stdout.cursorTo(0)
			process.stdout.write(dataBuffer)
			dataBuffer = d[1]
		}
		//process.stdout.clearLine()
		//process.stdout.cursorTo(0)
		//process.stdout.write(rawData.toString())
		/* let d = rawData.toString().split(' ')
		let data = {
			lat: d[0],
			lon: d[1],
			uv1: d[2],
			uv2: d[3],
			uv3: d[4]
		} */
	})
}

main()