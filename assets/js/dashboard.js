document.addEventListener("DOMContentLoaded",async function(){
  var api=window.hireInAI,client=api&&api.client;if(!client)return;
  var notice=document.getElementById("dashboardMessage"),auth=await client.auth.getUser(),user=auth.data&&auth.data.user;
  if(!user){location.href="login.html?next=dashboard.html";return;}
  var profile=await api.getProfile(user.id);
  document.getElementById("userName").textContent=(profile.data&&profile.data.full_name)||user.email||"Candidate";
  var profileForm=document.getElementById("profileForm"),profileData=await client.from("profiles").select("full_name,phone").eq("user_id",user.id).maybeSingle();
  var hasPhone=true;
  if(profileData.error&&(profileData.error.code==="PGRST204"||profileData.error.code==="42703"||/phone.*column|column.*phone/i.test(profileData.error.message||""))){hasPhone=false;profileData=await client.from("profiles").select("full_name").eq("user_id",user.id).maybeSingle();}
  if(profileData.data){profileForm.elements.full_name.value=profileData.data.full_name||"";profileForm.elements.phone.value=profileData.data.phone||"";}
  profileForm.addEventListener("submit",async function(event){event.preventDefault();var values=new FormData(profileForm),changes={full_name:String(values.get("full_name")).trim()};if(hasPhone)changes.phone=String(values.get("phone")).trim()||null;var save=await client.from("profiles").update(changes).eq("user_id",user.id);if(save.error){api.showMessage(notice,"Could not save profile: "+save.error.message,"error");return;}document.getElementById("userName").textContent=String(values.get("full_name")).trim()||user.email;api.showMessage(notice,"Profile saved.","success");});
  var appRes=await client.from("applications").select("id,status,applied_at,resume_url,jobs!applications_job_id_fkey(title,company)").eq("user_id",user.id).order("id",{ascending:false});
  if(appRes.error)api.showMessage(notice,"Could not load applications: "+appRes.error.message,"error");
  var apps=appRes.data||[],applicationPaths=new Set(apps.map(function(item){return item.resume_url;}).filter(Boolean));
  document.getElementById("applicationCount").textContent=apps.length;
  document.getElementById("applicationList").innerHTML=apps.length?apps.map(function(item){return "<tr><td>"+api.escapeHtml(item.jobs&&item.jobs.title||"Job")+"</td><td>"+api.escapeHtml(item.jobs&&item.jobs.company||"-")+"</td><td>"+api.escapeHtml(item.status||"Applied")+"</td><td>"+api.escapeHtml(item.applied_at?new Date(item.applied_at).toLocaleDateString():"-")+"</td></tr>";}).join(""):"<tr><td colspan='4' class='empty'>No applications yet. Browse jobs to apply.</td></tr>";
  var savedRes=await client.from("saved_jobs").select("id,job_id,jobs!saved_jobs_job_id_fkey(title,company,location)").eq("user_id",user.id).order("id",{ascending:false});
  var saved=savedRes.data||[];document.getElementById("savedCount").textContent=saved.length;
  document.getElementById("savedList").innerHTML=savedRes.error?"<tr><td colspan='3' class='empty'>"+api.escapeHtml(savedRes.error.message)+"</td></tr>":saved.length?saved.map(function(item){var job=item.jobs||{};return "<tr><td><a href='job-single.html?id="+encodeURIComponent(item.job_id)+"'>"+api.escapeHtml(job.title||"Job")+"</a></td><td>"+api.escapeHtml(job.company||"-")+"</td><td><button class='small-button danger' data-unsave='"+Number(item.id)+"'>Remove</button></td></tr>";}).join(""):"<tr><td colspan='3' class='empty'>No saved jobs yet.</td></tr>";
  document.getElementById("savedList").addEventListener("click",async function(event){var button=event.target.closest("[data-unsave]");if(!button)return;button.disabled=true;var result=await client.from("saved_jobs").delete().eq("id",Number(button.dataset.unsave)).eq("user_id",user.id);if(result.error){api.showMessage(notice,result.error.message,"error");button.disabled=false;return;}button.closest("tr").remove();saved.length--;document.getElementById("savedCount").textContent=saved.length;});
  var atsRes=await client.from("ats_history").select("id,score,missing_keywords,created_at,jobs(title)").eq("user_id",user.id).order("id",{ascending:false}).limit(10);
  var history=atsRes.data||[];document.getElementById("atsCount").textContent=history.length;
  document.getElementById("atsList").innerHTML=atsRes.error?"<tr><td colspan='3' class='empty'>"+api.escapeHtml(atsRes.error.message)+"</td></tr>":history.length?history.map(function(item){return "<tr><td>"+api.escapeHtml(item.jobs&&item.jobs.title||"Resume review")+"</td><td><strong>"+Number(item.score)+"%</strong></td><td>"+api.escapeHtml(item.created_at?new Date(item.created_at).toLocaleDateString():"-")+"</td></tr>";}).join(""):"<tr><td colspan='3' class='empty'>No ATS checks yet.</td></tr>";
  var resumeRes=await client.from("resumes").select("id,name,storage_path,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
  var resumes=resumeRes.data||[],resumeRows=[];
  for(var i=0;i<resumes.length;i++){
    var file=resumes[i],signed=await client.storage.from("resumes").createSignedUrl(file.storage_path,3600),href=signed.data&&signed.data.signedUrl;
    var remove=applicationPaths.has(file.storage_path)?"<span class='muted'>Used for an application</span>":"<button class='small-button danger' data-remove-resume='"+api.escapeHtml(file.id)+"' data-path='"+api.escapeHtml(file.storage_path)+"'>Remove</button>";
    resumeRows.push("<tr><td>"+api.escapeHtml(file.name)+"</td><td>"+api.escapeHtml(new Date(file.created_at).toLocaleDateString())+"</td><td>"+(href?"<a class='text-link' target='_blank' rel='noopener' href='"+api.escapeHtml(href)+"'>Download</a> ":"Unavailable ")+remove+"</td></tr>");
  }
  document.getElementById("resumeCount").textContent=resumes.length;
  var resumeList=document.getElementById("resumeList");
  resumeList.innerHTML=resumeRes.error?"<tr><td colspan='3' class='empty'>"+api.escapeHtml(resumeRes.error.message)+"</td></tr>":resumeRows.length?resumeRows.join(""):"<tr><td colspan='3' class='empty'>No resumes uploaded yet.</td></tr>";
  resumeList.addEventListener("click",async function(event){
    var button=event.target.closest("[data-remove-resume]");if(!button)return;
    if(!confirm("Remove this resume from your account?"))return;
    button.disabled=true;
    var removed=await client.storage.from("resumes").remove([button.dataset.path]);
    if(removed.error){api.showMessage(notice,"Could not remove file: "+removed.error.message,"error");button.disabled=false;return;}
    var record=await client.from("resumes").delete().eq("id",button.dataset.removeResume).eq("user_id",user.id);
    if(record.error){api.showMessage(notice,"File removed, but its resume record could not be removed: "+record.error.message,"error");return;}
    button.closest("tr").remove();document.getElementById("resumeCount").textContent=Math.max(0,resumes.length-1);
  });
});
