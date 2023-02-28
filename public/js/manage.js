let clientGuid;


window.addEventListener("message", async function (e) {
    //if (e.origin !== "https://sell.oliverpos.com") return;
    
    const msg = JSON.parse(e.data);
	console.log("msg: ", msg);
    let eventType = msg.command ? msg.command : msg.oliverpos.event;

    switch(eventType) {
        case 'ClientInfo':
            clientGuid = msg.data.clientGuid;
            auth(clientGuid);
            console.log("clientGuid: ", clientGuid);
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


async function auth(guid){
    let req = await fetch("/manage/setup/authenticate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: guid
        })
    });
    
    let accountData = await req.json();
    console.log("accountData: ", accountData);
    if (accountData.status_code == 200) {
        let tssList = accountData.tssList;
        if (tssList.length != 0){
            let tssListObj = document.getElementById('tss_list');
            tssListObj.style.display = "Block";
            for (i = 0; i < tssList.length; i++) {
                let tssObject = document.createElement("div");
                tssObject.setAttribute("id", `tss_obj${i+1}`);
    
                let tssObjectAttr1 = document.createElement("div");
                tssObjectAttr1.setAttribute("class", `tss_list_attr`);
                let tssIdLabel = document.createElement("label");
                tssIdLabel.innerHTML = "TSS ID";
                
                let tssIdinput = document.createElement("input");
                tssIdinput.type = "text";
                tssIdinput.name = tssList[i]._id;
                tssIdinput.value = tssList[i]._id;
                tssObjectAttr1.appendChild(tssIdLabel);
                tssObjectAttr1.appendChild(document.createElement("br"))
                tssObjectAttr1.appendChild(tssIdinput);
    
                let tssObjectAttr2 = document.createElement("div");
                tssObjectAttr2.setAttribute("class", `tss_list_attr`);
                let outletLabel = document.createElement("label");
                outletLabel.innerHTML = "Outlet";
                
                let outletLabelinput = document.createElement("input");
                outletLabelinput.type = "text";
                outletLabelinput.name = tssList[i].metadata.outlet_name;
                outletLabelinput.value = tssList[i].metadata.outlet_name;
                tssObjectAttr2.appendChild(outletLabel);
                tssObjectAttr2.appendChild(document.createElement("br"))
                tssObjectAttr2.appendChild(outletLabelinput);

                let disableButton = document.createElement("button");
                disableButton.type = "button";
                disableButton.setAttribute("class", "button");

                let disableButtonText = document.createElement("span");
                disableButtonText.setAttribute("class", "button__text");
                disableButtonText.innerHTML = "Disable";
                disableButton.appendChild(disableButtonText)


                disableButton.id = tssList[i]._id;
                disableButton.onclick = async () => {
                    disableButton.disabled = true;
                    disableButton.classList.add("button--loading");

                    let req = await fetch("/manage/setup/disableTSS", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            clientGuid: guid,
                            tssId: disableButton.id
                        })
                    });
                    
                    let disableRes = await req.json();
                    console.log("disableRes: ", disableRes);

                    disableButton.disabled = false;
                    disableButton.classList.remove("button--loading");

                    if (disableRes.status_code == 200) {
                        window.location.replace(window.location.origin + '/manage/dashboard');
                    }
                }

                let clientSettings = document.createElement("button");
                clientSettings.type = "button";
                clientSettings.setAttribute("class", "button");

                let clientSettingsText = document.createElement("span");
                clientSettingsText.setAttribute("class", "button__text");
                clientSettingsText.innerHTML = "Client Settings";
                clientSettings.appendChild(clientSettingsText)
    
                clientSettings.id = tssList[i]._id;
                clientSettings.name = tssList[i].metadata.outlet_name;
                clientSettings.onclick = async () => {
                    window.location.replace(`/manage/setup/clients?clientGuid=${clientGuid}&tssId=${clientSettings.id}&outlet=${clientSettings.name}`);
                }
                
                tssObject.appendChild(tssObjectAttr1);
                tssObject.appendChild(tssObjectAttr2);
                tssObject.appendChild(disableButton);
                tssObject.appendChild(clientSettings);
                tssListObj.appendChild(tssObject);
    
            }
        }
    }
    
}

async function createTSS(){
    document.getElementById('createTSS_btn').disabled = true;
    document.getElementById('createTSS_btn').classList.add("button--loading");
    
    let req = await fetch("/manage/setup/createTSS", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGuid,
            outlet: document.getElementById('set_outlet').value
        })
    });

    let createTSS = await req.json();
    console.log("createTSS: ", createTSS);
    document.getElementById('createTSS_btn').disabled = false;
    document.getElementById('createTSS_btn').classList.remove("button--loading");

    if (createTSS.status_code == 200) {
        let tssList = createTSS.tssList;
        if (tssList.length != 0){
            let tssListObj = document.getElementById('tss_list');
            tssListObj.style.display = "Block";
            for (i = 0; i < tssList.length; i++) {
                let tssObject = document.createElement("div");
                tssObject.setAttribute("id", `tss_obj${i+1}`);
    
                let tssObjectAttr1 = document.createElement("div");
                tssObjectAttr1.setAttribute("class", `tss_list_attr`);
                let tssIdLabel = document.createElement("label");
                tssIdLabel.innerHTML = "TSS ID";
                
                let tssIdinput = document.createElement("input");
                tssIdinput.type = "text";
                tssIdinput.name = tssList[i]._id;
                tssIdinput.value = tssList[i]._id;
                tssObjectAttr1.appendChild(tssIdLabel);
                tssObjectAttr1.appendChild(document.createElement("br"))
                tssObjectAttr1.appendChild(tssIdinput);
    
                let tssObjectAttr2 = document.createElement("div");
                tssObjectAttr2.setAttribute("class", `tss_list_attr`);
                let outletLabel = document.createElement("label");
                outletLabel.innerHTML = "Outlet";
                
                let outletLabelinput = document.createElement("input");
                outletLabelinput.type = "text";
                outletLabelinput.name = tssList[i].metadata.outlet_name;
                outletLabelinput.value = tssList[i].metadata.outlet_name;
                tssObjectAttr2.appendChild(outletLabel);
                tssObjectAttr2.appendChild(document.createElement("br"))
                tssObjectAttr2.appendChild(outletLabelinput);
    
    
                let disableButton = document.createElement("button");
                disableButton.type = "button";
                disableButton.setAttribute("class", "button");

                let disableButtonText = document.createElement("span");
                disableButtonText.setAttribute("class", "button__text");
                disableButtonText.innerHTML = "Disable";
                disableButton.appendChild(disableButtonText)

                disableButton.id = tssList[i]._id;
                disableButton.onclick = async () => {

                    disableButton.disabled = true;
                    disableButton.classList.add("button--loading");

                    let req = await fetch("/manage/setup/disableTSS", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            clientGuid: clientGuid,
                            tssId: disableButton.id

                        })
                    });
                    
                    let disableRes = await req.json();
                    console.log("disableRes: ", disableRes);
                    disableButton.disabled = false;
                    disableButton.classList.remove("button--loading");

                    if (disableRes.status_code == 200) {
                        window.location.replace(window.location.origin + '/manage/dashboard');
                    }
                }
    
                let clientSettings = document.createElement("button");
                clientSettings.type = "button";
                clientSettings.setAttribute("class", "button");

                let clientSettingsText = document.createElement("span");
                clientSettingsText.setAttribute("class", "button__text");
                clientSettingsText.innerHTML = "Client Settings";
                clientSettings.appendChild(clientSettingsText)
                
                clientSettings.id = tssList[i]._id;
                clientSettings.name = tssList[i].metadata.outlet_name;
                clientSettings.onclick = async () => {
                    window.location.replace(`/manage/setup/clients?clientGuid=${clientGuid}&tssId=${clientSettings.id}&outlet=${clientSettings.name}`);
                }
                
                tssObject.appendChild(tssObjectAttr1);
                tssObject.appendChild(tssObjectAttr2);
                tssObject.appendChild(disableButton);
                tssObject.appendChild(clientSettings);
                tssListObj.appendChild(tssObject);
    
            }
        }
    }
    
}

async function getClients(){
    let req = await fetch("/manage/setup/clients", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientGuid: clientGuid
        })
    });

    let getClients = await req.json();
    console.log("getClients: ", getClients);
}