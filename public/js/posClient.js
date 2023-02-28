let totalAmt = -1;
let totalTax = -1;
let currency =1;
let currentView = -1;
let registerId = -1;
let registerName = -1;
let locationId;
let outlet = -1;
let clientGUID = -1;
let payments = [];
let readyToSend = false;
let qrCodeData;



window.addEventListener('DOMContentLoaded', () => {
    let appReady = {
		command: "appReady",
		method: "get",
		version: "1.0"
	};
	window.parent.postMessage(JSON.stringify(appReady), '*');
});

function sendMessage(eventType) {
    var paymentMsg = {
        oliverpos:{
            event: eventType
        }
    }
    window.parent.postMessage(JSON.stringify(paymentMsg), '*')
};

function postReceipt(){
    let receiptInfo = {
        command: "Receipt",
		method: "post",
		version: "1.0",
        url: imgUrl,
        quantity: 1
	};
    window.parent.postMessage(JSON.stringify(receiptInfo), '*');
}

window.addEventListener('message', async (e) => {
    let msg = JSON.parse(e.data);
    console.log("msg: ", msg);
	let eventType = msg.command ? msg.command : msg.oliverpos.event;
    switch (eventType){
			
        // case 'checkoutComplete':
		// 	currentEvent = 'checkoutComplete';
        //     totalAmt = msg.data.orderDetails.order_total;
		// 	totalTax = msg.data.orderDetails.order_tax;
        //     paymentMethods = msg.data.orderDetails.order_payments;
		// 	break;
			
		case 'clientInfo':
            clientGUID = msg.data.clientGUID;
            console.log("Client info: ", clientGUID);
            break;
			
		case 'registerInfo':
			registerName = msg.data.name;
            let transaction = {
                command: "Transaction",
                method: "get",
                version: "1.0"
            };
            window.parent.postMessage(JSON.stringify(transaction), '*');
			break;

        case 'appReady':
            clientGUID = msg.data.clientGUID;
            currentView = msg.data.view;
            let getEnvironment = {
                "command": "Environment",
                "method": "get",
                "version": "1.0"
            };
            window.parent.postMessage(JSON.stringify(getEnvironment), '*');

            break;

        case 'Environment':
            registerId = msg.register_id;
            locationId = msg.location_data.location_id;
            outlet = msg.location_data.outlet;
            let registerInfo = {
                oliverpos:{
                    event: "registerInfo"
                }
            }
            window.parent.postMessage(JSON.stringify(registerInfo), '*')
            break;

        case 'Transaction':
            payments = msg.data.payments;
            
            let cartValue = {
                command: "CartValue",
                method: "get",
                version: "1.0"
            };
            window.parent.postMessage(JSON.stringify(cartValue), '*');
            break;
        
        case 'CartValue':
            totalAmt = msg.data.sub_total;
            totalTax = msg.data.total_tax;
            currency= msg.data.currency;
            readyToSend = true;
            break;

    }
	
	if (totalAmt != -1 && totalTax != -1 && currentView != -1 && payments.length != 0 && currency != -1 && registerId != -1 && registerName != -1 && outlet != -1 && clientGUID != -1){
		console.log("currentView: ", currentView);
		console.log("totalAmt: ", totalAmt);
		console.log("totalTax: ", totalTax);
		console.log("payments: ", payments);
        document.getElementById('sendTransBtn').disabled = false;	
	}
    
	
});



async function sendTrans() {
    document.getElementById('sendTransBtn').style.display = "none";
    document.getElementById('sendTransBtn').disabled = true;
    let req = await fetch("/pos/transactions/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGUID,
            registerName: registerName,
            registerId: registerId,
            outlet: outlet,
            totalAmt: totalAmt,
            totalTax: totalTax,
            currency: currency
        })
    })
    let startTransData = await req.json();
    console.log("FISKALY START TRANS RESPONSE: ", startTransData);

    if (startTransData.status_code == 200) {
        let clientID = startTransData.start_trans_details.client_id;
        let clientSerialNum = startTransData.start_trans_details.client_serial_number;
        let latestRevision = startTransData.start_trans_details.latest_revision;
        let txID = startTransData.start_trans_details._id;
        

        let req = await fetch("/pos/transactions/finish", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                clientGuid: clientGUID,
                txId: txID,
                registerName: registerName,
                clientId: clientID,
                payments: payments
            })
        })

        let finishTransData = await req.json();
        console.log("FISKALY FINISH TRANS RESPONSE: ", finishTransData);
        if (finishTransData.status_code == 200) {
            qrCodeData = finishTransData.finish_trans_details.qr_code_data;    
            printQr();
        }
    }

}

async function printQr() {
    let req = await fetch("/pos/transactions/image/upload", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGUID,
            qrData: qrCodeData
        })
    })

    let uploadImage = await req.json();

    if (uploadImage.status_code == 200) {
        let printQr = {
            command: 'DataToReceipt',
            method: 'post',
             version: '1.0',
            url: window.location.origin + `/pos/transactions/image/fetch?clientGuid=${clientGUID}`
       };
        
       window.parent.postMessage(JSON.stringify(printQr), "*");
    }
}

