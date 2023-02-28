
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

    let req = await fetch("/manage/loading", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_guid: msg.data.clientGuid
        })
    });
    
    let authData = await req.json();
    
    
    console.log("AUTH RESPONSE: ", authData.statusCode);
    
    let baseURL = window.location.origin;
    
    if (authData.statusCode == 200){
    
        window.location.replace(baseURL + '/manage/dashboard');
    }else{
    
        window.location.replace(baseURL + '/manage/signup');
    }

	
});



//TESTTING
/*
async function testFunc() {
    let req = await fetch("/manage/loading", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_guid: '1daed7e2-c749-4636-b75a-a5063c980a6f'
        })
    });
    
    let authData = await req.json();
    
    
    console.log("AUTH RESPONSE: ", authData.statusCode);
    
    let baseURL = window.location.origin;
    
    if (authData.statusCode == 200){
    
        window.location.replace(baseURL + '/manage/dashboard');
    }else{
    
        window.location.replace(baseURL + '/manage/signup');
    }
}

testFunc();
*/  


