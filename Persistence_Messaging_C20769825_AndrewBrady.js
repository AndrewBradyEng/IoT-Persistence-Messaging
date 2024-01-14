const deviceOfInterest = 'F4:40:D6:F8:C1:81' // Device MAC address of interest
const serviceOfInterestUuid = '00000001-0002-0003-0004-000000002000' // UUID of button A service
const characteristicOfInterestUuid = '00000001-0002-0003-0004-000000002001' // UUID of read/notify characteristic of button A service
const serviceOfInterestUuid1 = '00000001-0002-0003-0004-000000003000' // UUID of LED service
const characteristicOfInterestUuid1 = '00000001-0002-0003-0004-000000003001'// UUID of characteristic of LED service
var mqtt = require('mqtt') //Require MQTT library

//MQTT connection configuration
const options = {
  username: 'c20769825',
  password: 'hello123',
  host: '7c32181a42cd45e58b39e793c7d3462d.s2.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts',
};

//Connect to MQTT broker using provided options
var mqttClient  = mqtt.connect(options);

//MQTT topics for subscribing and publishing
var topicToSubscribeTo="DailyStepsSub";
var topicToPublishTo="DailyStepsPub";

var countVal = 0; //Initialise a count value
var charactL; //Placeholder for LED characteristics
var chars; //Placeholder for button characteristics

console.log("Starting mqtt client application on the gateway device now");

//Callback function for MQTT publish
function publishCallback(error){
	if (error){
		console.log("error publishing data");
    }
}

mqttClient.on('connect', connectCallback); // Event listener for MQTT client 'connect' event

//Callback function when connected to MQTT broker
function connectCallback() {
	console.log("connected to MQTT broker");
	mqttClient.subscribe(topicToSubscribeTo, subscribeCallback); /* sample3 MQTT code */
}

//Callback function for MQTT subscription
function subscribeCallback(error, granted) { 
   	if (error) {
		console.log("error subscribing to topic");
	} else {	
		console.log("subscrited to messages on topic : ")   
		for(var i=0; i<granted.length;i++){
			console.log(granted[i]);
		}
    }
}

const main = async() => {
//async function main () {
  const {createBluetooth}=require('node-ble')
  const { bluetooth, destroy } = createBluetooth() //this is the same as const bluetooth = (object returned by createBluetooth()).bluetooth; const destroy = (object returned by createBluetooth()).destroy; 

  // get bluetooth adapter
  const adapter = await bluetooth.defaultAdapter() //get an available Bluetooth adapter
  await adapter.startDiscovery() //using the adapter, start a device discovery session  
  console.log('discovering')

  // look for a specific device 
  const device = await adapter.waitDevice(deviceOfInterest)
  console.log('got device', await device.getAddress())// await device.getAddress())
  const deviceName = await device.getName()
  console.log('got device remote name', deviceName)
  console.log('got device user friendly name', await device.toString())

  await adapter.stopDiscovery() 
  //connect to the specific device
  await device.connect()
  console.log("connected to device : " + deviceName)

  const gattServer = await device.gatt()
  services = await gattServer.services()
  console.log("services are " + services)

  //Handle LED service if available
  if (services.includes(serviceOfInterestUuid1)) { //uuid of service broker to LED
	  console.log('got the LED service')
	  const primaryLService = await gattServer.getPrimaryService(serviceOfInterestUuid1)
	  charsL = await primaryLService.characteristics(serviceOfInterestUuid1)
	  //console.log("the service characteristics are : " + chars)
	  charactL = await primaryLService.getCharacteristic(characteristicOfInterestUuid1)
      //Handle incoming MQTT messages for LED control
	  mqttClient.on('message', messageEventHandler);

  async function messageEventHandler(topic, message, packet) { 
    console.log("Received message'" + message + "' on topic '" + topic + "'");

    if(message == 'on') {
		charactL = await charactL.writeValue(Buffer.from([01])) //turning LED on from broker with message 'on'
	} else {
		charactL = await charactL.writeValue(Buffer.from([00]))
	}
	}
}

//Handle button service if available
if (services.includes(serviceOfInterestUuid)) { //uuid of service button press to broker
	  console.log('got the button service')
	  const primaryService = await gattServer.getPrimaryService(serviceOfInterestUuid)
	  chars = await primaryService.characteristics(serviceOfInterestUuid)
	  console.log("the service characteristics are : " + chars)
	  console.log("uuid of characteristic of interest is : " + characteristicOfInterestUuid)
	  charact = await primaryService.getCharacteristic(characteristicOfInterestUuid)
	  console.log("characteristic flags are : " + await charact.getFlags())
	  await charact.startNotifications()

      //Listen for changes in button characteristic value
	  charact.on('valuechanged', buffer => {
		 ++countVal
		 MyDataLogger(countVal);
		 insertMariaDB(countVal);
		  if(countVal %2 ==0){
		  	console.log(countVal + " steps taken");
		  	mqttClient.publish(topicToPublishTo, countVal + " steps taken", publishCallback); }
		  })
	}
}

//Function to publish MQTT error messages
function publishCallback(error) {     
   	if (error) {
		console.log("error publishing data");
	} else {	 
        console.log("Message is published to topic '" + topicToPublishTo+ "'");
        //mqttClient.end(); // Close the connection to the broker when published
    }
}

//Function to insert into InfluxDB
const Influx=require('influx');

async function MyDataLogger(countval) {
	const Math=require('math');
	const influx = new Influx.InfluxDB({
		host: '127.0.0.1',
		database : 'tshealth_C20769825',
		schema: [
		{
			measurement: 'DailySteps',
			fields: { buttonCounter : Influx.FieldType.FLOAT
			 },
				tags : ['unit']
		}
		]
	});

	await influx.writePoints([
	{
		measurement : 'DailySteps',
		tags : {
			unit: 'steps',
		},
		fields : {	buttonCounter : countval
		}
	}
	], {
		database: 'tshealth_C20769825',
		precision: 'times',
	}
	)
}

//Function to insert into MariaDB
async function insertMariaDB(countVal) {
	const mariadb = require('mariadb/callback');
	const dbConn = mariadb.createConnection({
	host: '127.0.0.1', 
	user:'C20769825', 
	password: 'C20769825', 
	database: 'rhealth_C20769825'
	});
	
	dbConn.query('INSERT INTO DailySteps (step_count, date_time) VALUES (?, NOW())', [countVal]);
}

main()
  .then()
  .catch(console.error)	