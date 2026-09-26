document.addEventListener("DOMContentLoaded",function(){
  if(!window.hireInAI||!window.hireInAI.client)return;
  var api=window.hireInAI,client=api.client;
  var loginForm=document.getElementById("loginForm");
  var signupForm=document.getElementById("signupForm");
  var googleButton=document.getElementById("googleLogin");
  var forgotForm=document.getElementById("forgotForm");
  var resetForm=document.getElementById("resetForm");
  if(googleButton)googleButton.addEventListener("click",async function(){
    googleButton.disabled=true;api.showMessage(document.getElementById("authMessage"),"Redirecting to Google...","");
    var result=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/dashboard"}});
    if(result.error){api.showMessage(document.getElementById("authMessage"),result.error.message,"error");googleButton.disabled=false;}
  });
  if(forgotForm)forgotForm.addEventListener("submit",async function(event){
    event.preventDefault();var email=String(new FormData(forgotForm).get("email")).trim(),button=forgotForm.querySelector("button[type=submit]");
    button.disabled=true;api.showMessage(document.getElementById("authMessage"),"Sending password reset email...","");
    var result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/reset-password"});
    button.disabled=false;if(result.error){api.showMessage(document.getElementById("authMessage"),result.error.message,"error");return;}
    api.showMessage(document.getElementById("authMessage"),"If an account exists for that address, a password reset link is on its way.","success");
  });
  if(resetForm)resetForm.addEventListener("submit",async function(event){
    event.preventDefault();var values=new FormData(resetForm),password=String(values.get("password")),confirmPassword=String(values.get("confirm_password")),button=resetForm.querySelector("button[type=submit]");
    if(password.length<8){api.showMessage(document.getElementById("authMessage"),"Use a password with at least 8 characters.","error");return;}
    if(password!==confirmPassword){api.showMessage(document.getElementById("authMessage"),"Passwords do not match.","error");return;}
    button.disabled=true;api.showMessage(document.getElementById("authMessage"),"Updating password...","");
    var result=await client.auth.updateUser({password:password});button.disabled=false;
    if(result.error){api.showMessage(document.getElementById("authMessage"),result.error.message,"error");return;}
    api.showMessage(document.getElementById("authMessage"),"Password updated. You can now sign in.","success");resetForm.reset();
  });
  if(loginForm)loginForm.addEventListener("submit",async function(event){
    event.preventDefault();
    var button=loginForm.querySelector("button[type=submit]"),notice=document.getElementById("authMessage"),values=new FormData(loginForm);
    button.disabled=true;api.showMessage(notice,"Signing in…","");
    var result=await client.auth.signInWithPassword({email:String(values.get("email")).trim(),password:String(values.get("password"))});
    button.disabled=false;
    if(result.error){api.showMessage(notice,result.error.message,"error");return;}
    location.href=api.safeNext();
  });
  if(signupForm)signupForm.addEventListener("submit",async function(event){
    event.preventDefault();
    var button=signupForm.querySelector("button[type=submit]"),notice=document.getElementById("authMessage"),values=new FormData(signupForm),password=String(values.get("password"));
    if(password.length<8){api.showMessage(notice,"Use a password with at least 8 characters.","error");return;}
    button.disabled=true;api.showMessage(notice,"Creating your candidate account…","");
    var result=await client.auth.signUp({email:String(values.get("email")).trim(),password:password,options:{data:{full_name:String(values.get("full_name")).trim()}}});
    button.disabled=false;
    if(result.error){api.showMessage(notice,result.error.message,"error");return;}
    if(result.data.session){location.href="dashboard.html";return;}
    api.showMessage(notice,"Account created. Check your email to confirm, then sign in.","success");
  });
});
