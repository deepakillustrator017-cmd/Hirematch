document.addEventListener("DOMContentLoaded",async function(){
  var api=window.hireInAI, form=document.getElementById("applicationForm");
  if(!api||!api.client||!form)return;
  var client=api.client,notice=document.getElementById("status"),submit=document.getElementById("submitButton");
  var jobId=new URLSearchParams(location.search).get("id"),jobTitle=document.getElementById("jobTitle");
  var user=null;
  var auth=await client.auth.getUser(); user=auth.data&&auth.data.user;
  var login=document.getElementById("loginLink");
  if(!user){if(login){login.href="login.html?next="+encodeURIComponent("apply.html?id="+(jobId||""));login.hidden=false;}api.showMessage(notice,"Sign in or create a candidate account before applying.","error");submit.disabled=true;return;}
  if(!jobId||!/^\d+$/.test(jobId)){jobTitle.textContent="Invalid job link";api.showMessage(notice,"Open this page from a job listing.","error");return;}
  var found=await client.from("jobs").select("id,title,company").eq("id",jobId).maybeSingle();
  if(found.error||!found.data){jobTitle.textContent="Job unavailable";api.showMessage(notice,found.error?found.error.message:"This job may have closed.","error");return;}
  jobTitle.textContent=found.data.title+(found.data.company?" · "+found.data.company:"");
  var profile=await api.getProfile(user.id);
  if(profile.data&&profile.data.full_name)form.elements.full_name.value=profile.data.full_name;
  if(user.email)form.elements.email.value=user.email;
  var savedResume=document.getElementById("savedResume"),resumeQuery=await client.from("resumes").select("id,name,storage_path").eq("user_id",user.id).order("created_at",{ascending:false});
  (resumeQuery.data||[]).forEach(function(resume){var option=document.createElement("option");option.value=resume.id;option.textContent=resume.name;option.dataset.path=resume.storage_path;savedResume.appendChild(option);});
  savedResume.addEventListener("change",function(){document.getElementById("resumeFile").required=!savedResume.value;});
  submit.disabled=false;
  form.addEventListener("submit",async function(event){
    event.preventDefault();
    var values=new FormData(form),file=values.get("resume_file"),chosen=savedResume.options[savedResume.selectedIndex],path=chosen&&chosen.value?chosen.dataset.path:null,resumeId=chosen&&chosen.value?Number(chosen.value):null;
    if(!path&&(!file||!file.size)){api.showMessage(notice,"Choose a saved resume or upload a PDF to continue.","error");return;}
    if(!path&&(file.type!=="application/pdf"||file.size>5*1024*1024)){api.showMessage(notice,"Upload a PDF smaller than 5 MB.","error");return;}
    submit.disabled=true;api.showMessage(notice,"Uploading resume and submitting your application…","");
    var newResumeId=null,uploadedPath=null;
    if(!path){var cleanName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),uploadedPath=user.id+"/applications/"+crypto.randomUUID()+"-"+cleanName;
      var upload=await client.storage.from("resumes").upload(uploadedPath,file,{contentType:"application/pdf",upsert:false});
      if(upload.error){api.showMessage(notice,"Resume upload failed: "+upload.error.message,"error");submit.disabled=false;return;}
      var resume=await client.from("resumes").insert({user_id:user.id,name:file.name,storage_path:uploadedPath}).select("id").single();
      if(resume.error){await client.storage.from("resumes").remove([uploadedPath]);api.showMessage(notice,"Could not save resume record: "+resume.error.message,"error");submit.disabled=false;return;} newResumeId=resume.data.id;path=uploadedPath;
    }
    var application=await client.from("applications").insert({
      job_id:Number(jobId),user_id:user.id,name:String(values.get("full_name")).trim(),
      email:String(values.get("email")).trim(),phone:String(values.get("phone")).trim(),
      portfolio:String(values.get("portfolio")).trim()||null,
      cover_letter:String(values.get("cover_letter")).trim()||null,
      resume_url:path,status:"Applied"
    });
    if(application.error){
      if(newResumeId){await client.from("resumes").delete().eq("id",newResumeId);await client.storage.from("resumes").remove([uploadedPath]);}
      api.showMessage(notice,"Application could not be submitted: "+application.error.message,"error");submit.disabled=false;return;
    }
    api.showMessage(notice,"Application submitted. You can track it in your dashboard.","success");
    form.reset();document.getElementById("resumeFile").required=true;submit.disabled=true;
  });
});
