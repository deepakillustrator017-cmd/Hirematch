document.addEventListener("DOMContentLoaded",async function(){
  var api=window.hireInAI,client=api&&api.client,form=document.getElementById("jobForm");if(!client||!form)return;
  var notice=document.getElementById("jobMessage"),button=form.querySelector("button[type=submit]"),params=new URLSearchParams(location.search),editId=params.get("edit");
  function missingColumn(error){return error&&(error.code==="PGRST204"||error.code==="42703"||/column .* does not exist|could not find the .* column/i.test(error.message||""));}
  var auth=await client.auth.getUser(),user=auth.data&&auth.data.user;if(!user){location.href="login.html?next="+encodeURIComponent(location.pathname+location.search);return;}
  var profile=await api.getProfile(user.id),role=profile.data&&profile.data.role;if(role!=="recruiter"&&role!=="admin"){api.showMessage(notice,"Only approved recruiters can post jobs.","error");button.disabled=true;return;}
  if(editId){var found=await client.from("jobs").select("*").eq("id",editId).maybeSingle();if(found.error||!found.data){api.showMessage(notice,found.error?found.error.message:"Job not found or not editable.","error");button.disabled=true;return;}
    var job=found.data;{var fields={title:job.title,company:job.company,category:job.category,location:job.location,type:job.employment_type||job.type,salary:job.salary,description:job.description,work_mode:job.work_mode,experience:job.experience,salary_min:job.salary_min,salary_max:job.salary_max,logo:job.logo,responsibilities:job.responsibilities,requirements:job.requirements,skills:Array.isArray(job.skills)?job.skills.join(", "):job.skills,benefits:job.benefits};Object.keys(fields).forEach(function(key){if(form.elements[key])form.elements[key].value=fields[key]||"";});}
    document.getElementById("jobPageTitle").textContent="Edit job";button.textContent="Save Changes";}
  form.addEventListener("submit",async function(event){event.preventDefault();var values=new FormData(form),salaryMin=String(values.get("salary_min")||"").trim(),salaryMax=String(values.get("salary_max")||"").trim();
    var type=String(values.get("type")).trim()||"Full time";
    var payload={title:String(values.get("title")).trim(),company:String(values.get("company")).trim(),category:String(values.get("category")).trim()||null,location:String(values.get("location")).trim(),type:type,employment_type:type,work_mode:String(values.get("work_mode")),experience:String(values.get("experience")).trim(),salary:String(values.get("salary")).trim()||"",salary_min:salaryMin?Number(salaryMin):null,salary_max:salaryMax?Number(salaryMax):null,logo:String(values.get("logo")).trim()||null,description:String(values.get("description")).trim(),responsibilities:String(values.get("responsibilities")).trim(),requirements:String(values.get("requirements")).trim(),skills:String(values.get("skills")).split(",").map(function(skill){return skill.trim();}).filter(Boolean),benefits:String(values.get("benefits")).trim(),status:"published"};
    if(!payload.title||!payload.company||!payload.location||!payload.description){api.showMessage(notice,"Complete all required fields.","error");return;}
    if(payload.salary_min&&payload.salary_max&&payload.salary_min>payload.salary_max){api.showMessage(notice,"Maximum salary should be greater than minimum salary.","error");return;}
    button.disabled=true;api.showMessage(notice,editId?"Saving changes…":"Publishing job…","");
    var saved=editId?await client.from("jobs").update(payload).eq("id",editId).select("id").maybeSingle():await client.from("jobs").insert(Object.assign(payload,{created_by:user.id})).select("id").single(),usedLegacyColumns=false;
    if(saved.error&&missingColumn(saved.error)){
      usedLegacyColumns=true;
      var sections=[payload.description,payload.responsibilities&&"Responsibilities\n"+payload.responsibilities,payload.requirements&&"Requirements\n"+payload.requirements,payload.skills.length&&"Skills\n"+payload.skills.join(", "),payload.benefits&&"Benefits\n"+payload.benefits].filter(Boolean);
      var legacy={title:payload.title,company:payload.company,category:payload.category,location:payload.location,employment_type:type,salary:payload.salary,description:sections.join("\n\n"),status:"published"};
      saved=editId?await client.from("jobs").update(legacy).eq("id",editId).select("id").maybeSingle():await client.from("jobs").insert(Object.assign(legacy,{created_by:user.id})).select("id").single();
    }
    button.disabled=false;if(saved.error){api.showMessage(notice,saved.error.message,"error");return;}
    api.showMessage(notice,usedLegacyColumns?"Job published. Run the HireIn AI schema migration to enable structured work mode, experience, and salary filters.":"Job published successfully.","success");location.href="admin.html";
  });
});
