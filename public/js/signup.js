let clientGUID;
window.addEventListener("DOMContentLoaded", () => {

    let clientInfo = {
        oliverpos:{
            event: "ClientInfo"
        }
    }
    window.parent.postMessage(JSON.stringify(clientInfo), '*')
	
});

window.addEventListener('message', async (e) => {
    
    let msg = JSON.parse(e.data);
    clientGUID = msg.data.clientGuid;


})

async function signup() {

    if (document.getElementById('apiKey').value != '' && document.getElementById('apiSecret').value != '') {

        document.getElementById('signup_btn').disabled = true;

        let req = await fetch("/manage/setup/onboard", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                clientGuid: clientGUID,
                apiKey: document.getElementById('apiKey').value,
                apiSecret: document.getElementById('apiSecret').value,
            })
        });
        
        let authData = await req.json();
        document.getElementById('signup_btn').disabled = false;

        if (authData.status_code == 200) {
            window.location.replace(window.location.origin + '/manage/dashboard');
        } else {
            document.getElementById('errorMsg').innerHTML = authData.msg;
            setTimeout(() => {
                document.getElementById('errorMsg').innerHTML = "";
            }, 3000);
            }

    } else {
        document.getElementById('errorMsg').innerHTML = "API Key / Secret cannot be blank.";
        setTimeout(() => {
            document.getElementById('errorMsg').innerHTML = "";
        }, 3000);
    }
}