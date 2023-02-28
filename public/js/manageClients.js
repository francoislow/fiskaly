const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

let clientGuid; 
let registerList;
const tssId = params.tssId; 
const outlet = params.outlet; 
let transactions;

console.log("tssId from param: ", tssId);
console.log("outlet from param: ", outlet);


window.addEventListener("message", async function (e) {
    //if (e.origin !== "https://sell.oliverpos.com") return;
    
    const msg = JSON.parse(e.data);
	console.log("msg: ", msg);
    let eventType = msg.command ? msg.command : msg.oliverpos.event;

    switch(eventType) {
        case 'ClientInfo':
            clientGuid = msg.data.clientGuid;
            console.log("clientGuid: ", clientGuid);
            fetchTrans(clientGuid);
            let listRegister = {
                oliverpos:{
                    event: "ListRegister"
                }
            }
            window.parent.postMessage(JSON.stringify(listRegister), '*')
            
            break;
			
		case 'ListRegister':
			registerList = msg.data;
            console.log("registerList: ", registerList);
            let registerSelectObj = document.getElementById('registerName');
            let currChildren = [...registerSelectObj.children];
            console.log("currChildren: ", currChildren);
            for (let i = 0; i < registerList.length; i++) {
                found = currChildren.find(child => child.innerHTML == registerList[i].Name)? true : false;
                console.log("found: ", found);

                if (found == false) {
                    
                    let registerOption = document.createElement('option');
                    registerOption.value = registerList[i].Id;
                    registerOption.innerHTML = registerList[i].Name;
                    registerSelectObj.appendChild(registerOption);
                }
            }
            
            
            

			break;

    }

    
    
    

});

window.addEventListener("DOMContentLoaded", () => {

    let clientInfo = {
        oliverpos:{
            event: "ClientInfo"
        }
    }
    window.parent.postMessage(JSON.stringify(clientInfo), '*')
	
});







async function createClient () {
    document.getElementById('createClient_btn').disabled = true;
    document.getElementById('createClient_btn').classList.add("button--loading");
    if (document.getElementById('registerName').value != "") {
        
        let req = await fetch("/manage/setup/createClient", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                clientGuid: clientGuid,
                tssId: tssId,
                registerName: document.getElementById('registerName').options[document.getElementById('registerName').selectedIndex].text,
                registerId: document.getElementById('registerName').value,
                outlet: outlet,
                serialNum:  document.getElementById('registerSerialNum').value
            })
        });
    
        let createClient = await req.json();
        console.log("createClient: ", createClient);

        document.getElementById('createClient_btn').disabled = false;
        document.getElementById('createClient_btn').classList.remove("button--loading");
    
        if (createClient.status_code == 200) {
            window.location.reload();
        } else {
            document.getElementById('errorMsg').innerHTML = createClient.msg;
            setTimeout(() => {
                document.getElementById('errorMsg').innerHTML = "";
            }, 3000);
        }

    } else {
        document.getElementById('errorMsg').innerHTML = "Cannot be blank.";
        setTimeout(() => {
            document.getElementById('errorMsg').innerHTML = "";
        }, 3000);
    }


}

async function viewTrans() {
    let clientId = document.getElementById('trans_dropdown').value;
    console.log("clientId: ", clientId);

    let filteredTrans = []
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].client_id == clientId) {
            filteredTrans.push(transactions[i]);
        }
    }

    let transHistContainer = document.getElementById('trans_history');
    transHistContainer.textContent = "";

    if (filteredTrans.length != 0) {
        
        let headerRow = document.createElement("tr");

        let txnIdHeader = document.createElement('th');
        txnIdHeader.innerHTML = "Txn Id.";
        let timeStartHeader = document.createElement('th');
        timeStartHeader.innerHTML = "Time Start.";
        let timeEndHeader = document.createElement('th');
        timeEndHeader.innerHTML = "Time End.";
        let revisionHeader = document.createElement('th');
        revisionHeader.innerHTML = "Revision.";
        let transAmtHeader = document.createElement('th');
        transAmtHeader.innerHTML = "Trans Amt.";
        let transTaxHeader = document.createElement('th');
        transTaxHeader.innerHTML = "Trans Tax.";

        headerRow.appendChild(txnIdHeader);
        headerRow.appendChild(timeStartHeader);
        headerRow.appendChild(timeEndHeader);
        headerRow.appendChild(revisionHeader);
        headerRow.appendChild(transAmtHeader);
        headerRow.appendChild(transTaxHeader);
        transHistContainer.appendChild(headerRow);
        
        for (let i = 0; i < filteredTrans.length; i++) {
            let transObjRow = document.createElement("tr");

            let txnId = document.createElement('td');
            txnId.innerHTML = filteredTrans[i]._id;
            let timeStart = document.createElement('td');
            let startDate = Date(filteredTrans[i].time_start);
            timeStart.innerHTML = startDate;
            let timeEnd = document.createElement('td');
            let endDate = Date(filteredTrans[i].time_end);
            timeEnd.innerHTML = endDate;
            let revision = document.createElement('td');
            revision.innerHTML = filteredTrans[i].revision;
            
            let transAmt = document.createElement('td');
            let payments = filteredTrans[i].schema.standard_v1.receipt.amounts_per_payment_type;
            let totalAmt = 0;
            for (let i = 0; i < payments.length; i++) {
                totalAmt += (payments[i].amount) * 100
            }
            transAmt.innerHTML = (totalAmt / 100).toFixed(2);

            let transTax = document.createElement('td');
            let taxes = filteredTrans[i].schema.standard_v1.receipt.amounts_per_vat_rate;
            let totalTaxes = 0;
            for (let i = 0; i < taxes.length; i++) {
                totalTaxes += (taxes[i].amount) * 100
            }
            transTax.innerHTML = (totalAmt / 100).toFixed(2);

            transObjRow.appendChild(txnId);
            transObjRow.appendChild(timeStart);
            transObjRow.appendChild(timeEnd);
            transObjRow.appendChild(revision);
            transObjRow.appendChild(transAmt);
            transObjRow.appendChild(transTax);
            transHistContainer.appendChild(transObjRow);
        }
        transHistContainer.style.display = "block";
    }

    

}

async function fetchTrans(clientGuid) {
    let req = await fetch("/manage/setup/transactions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGuid,
            tssId: tssId
        })
    });

    let getTrans = await req.json();
    console.log("getTrans: ", getTrans);

    if (getTrans.status_code == 200) {
        transactions = getTrans.trans_list;
        console.log("transactions: ", transactions);
    } else {
        document.getElementById('fetchTransMsg').innerHTML = getTrans.msg;
    }
}

async function deregister(event) {

    var source = event.target || event.srcElement;
    console.log('source: ', source);
    console.log('source.id: ', source.id);
    console.log('source.name: ', source.name);

    let req = await fetch("/manage/setup/deregister", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGuid,
            clientId: source.id,
            serialNum: source.name,
            tssId: tssId,
            outlet: outlet
        })
    });

    let deregisterRes = await req.json();
    console.log("deregisterRes: ", deregisterRes);

    if (deregisterRes.status_code == 200) {
        window.location.reload(true);
    } else {
        document.getElementById('deregisterError').innerHTML = deregisterRes.msg;
        setTimeout(() => {
            document.getElementById('deregisterError').innerHTML = '';
        }, 3000);
    }

}