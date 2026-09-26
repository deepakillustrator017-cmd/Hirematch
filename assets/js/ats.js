document.addEventListener("DOMContentLoaded", async function () {
  var api = window.hireInAI, client = api && api.client; if (!client) return;
  var form = document.getElementById("atsForm"), jobSelect = document.getElementById("jobId"), description = document.getElementById("jobDescription");
  var notice = document.getElementById("atsMessage"), result = document.getElementById("atsResult"), button = document.getElementById("analyzeButton");
  function missingColumn(error) { return error && (error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(error.message || "")); }
  var auth = await client.auth.getUser(), user = auth.data && auth.data.user;
  if (!user) { api.showMessage(notice,"Sign in to analyze and save your ATS history.","error"); var link=document.getElementById("atsLogin"); if(link){link.href="login.html?next=ats.html";link.hidden=false;} button.disabled=true; return; }
  var jobs = await client.from("jobs").select("id,title,company,description").order("id",{ascending:false});
  if (jobs.error) { api.showMessage(notice,"Could not load jobs: "+jobs.error.message,"error"); return; }
  (jobs.data||[]).forEach(function(job){var option=document.createElement("option");option.value=job.id;option.textContent=job.title+" — "+job.company;option.dataset.description=job.description||"";jobSelect.appendChild(option);});
  jobSelect.addEventListener("change",function(){var opt=jobSelect.options[jobSelect.selectedIndex];if(opt&&opt.dataset.description)description.value=opt.dataset.description;});
  form.addEventListener("submit", async function(event){
    event.preventDefault(); var file=document.getElementById("resumeFile").files[0]; if(!file){api.showMessage(notice,"Choose a PDF or DOCX resume first.","error");return;}
    var ext=file.name.toLowerCase().split(".").pop(); if(!["pdf","docx"].includes(ext)||file.size>5*1024*1024){api.showMessage(notice,"Upload a PDF or DOCX smaller than 5 MB.","error");return;}
    var jobText=description.value.trim();if(jobText.length<40){api.showMessage(notice,"Choose a job or add a fuller job description (at least 40 characters).","error");return;}
    button.disabled=true;api.showMessage(notice,"Reading your resume and matching skills…","");
    try {
      var resumeText="";
      if(ext==="pdf"){
        if(!window.pdfjsLib)throw new Error("PDF reader did not load. Refresh and try again.");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        var pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,parts=[];
        for(var p=1;p<=pdf.numPages;p++){var page=await pdf.getPage(p),content=await page.getTextContent();parts.push(content.items.map(function(item){return item.str;}).join(" "));} resumeText=parts.join(" ");
      } else {
        if(!window.mammoth)throw new Error("DOCX reader did not load. Refresh and try again.");
        var extracted=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});resumeText=extracted.value||"";
      }
      if(resumeText.trim().length<40)throw new Error("No readable text found. Upload a text-based PDF or DOCX.");
      var stop=new Set("the and for with from that this your you our are was were will have has had into about their them they then than when where what which while using use used also can may should must job role work team company candidate experience skills ability".split(" "));
      var keywords=Array.from(new Set((jobText.toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g)||[]))).filter(function(word){return !stop.has(word);}).slice(0,60);
      if(!keywords.length)throw new Error("Could not find enough keywords in the job description.");
      var lower=resumeText.toLowerCase(),matched=keywords.filter(function(word){return lower.includes(word);}),missing=keywords.filter(function(word){return !lower.includes(word);}).slice(0,12),score=Math.round(matched.length/keywords.length*100);
      var formatting=[];if(!/\b(experience|employment|work history)\b/i.test(resumeText))formatting.push("Add a standard Experience section heading.");if(!/\b(education|qualification)\b/i.test(resumeText))formatting.push("Add a standard Education section heading.");if(resumeText.length>18000)formatting.push("Keep the resume concise and prioritize relevant experience.");
      var tips=[];if(missing.length)tips.push("Add relevant missing terms only where they truthfully describe your experience: "+missing.slice(0,6).join(", ")+".");if(score<70)tips.push("Tailor your summary and recent experience to the role's core responsibilities.");tips.push("Use measurable outcomes and standard section headings. This is a keyword estimate, not a hiring decision.");
      var ai=window.HireInAIService;
      if(ai){try{var review=await ai.calculateATS({resume:resumeText.slice(0,18000),jobDescription:jobText.slice(0,12000)});if(Number.isFinite(Number(review.score)))score=Math.max(0,Math.min(100,Math.round(Number(review.score))));if(Array.isArray(review.matchedSkills))matched=review.matchedSkills.slice(0,30);if(Array.isArray(review.missingKeywords))missing=review.missingKeywords.slice(0,12);if(Array.isArray(review.formattingIssues))formatting=review.formattingIssues.slice(0,8);if(Array.isArray(review.suggestions))tips=review.suggestions.slice(0,8);}catch(e){/* The keyword score remains available when AI is not configured. */}}
      var path=user.id+"/ats/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      var upload=await client.storage.from("resumes").upload(path,file,{contentType:ext==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",upsert:false});if(upload.error)throw new Error("Resume upload failed: "+upload.error.message);
      var resume=await client.from("resumes").insert({user_id:user.id,name:file.name,storage_path:path});if(resume.error){await client.storage.from("resumes").remove([path]);throw new Error(resume.error.message);}
      var jobIdValue=jobSelect.value?Number(jobSelect.value):null;
      var historyRow={user_id:user.id,job_id:jobIdValue,resume_name:file.name,resume_path:path,score:score,matched_keywords:matched,missing_keywords:missing,suggestions:tips.join(" "),details:{formatting_issues:formatting}};
      var saved=await client.from("ats_history").insert(historyRow);
      if(saved.error&&missingColumn(saved.error)){delete historyRow.resume_path;delete historyRow.details;saved=await client.from("ats_history").insert(historyRow);}
      if(saved.error){api.showMessage(notice,"Score calculated and resume saved, but history could not be saved: "+saved.error.message,"error");button.disabled=false;return;}
      document.getElementById("scoreValue").textContent=score;document.getElementById("scoreRing").style.setProperty("--score",score+"%");
      document.getElementById("matchedKeywords").textContent=matched.length?matched.join(", "):"No matching skills found";document.getElementById("missingKeywords").textContent=missing.length?missing.join(", "):"No major missing keywords";
      document.getElementById("suggestions").innerHTML="<ul>"+tips.map(function(t){return "<li>"+api.escapeHtml(t)+"</li>";}).join("")+"</ul>";document.getElementById("formattingIssues").innerHTML=formatting.length?"<ul>"+formatting.map(function(t){return "<li>"+api.escapeHtml(t)+"</li>";}).join("")+"</ul>":"<p>No common formatting issues detected.</p>";
      result.hidden=false;api.showMessage(notice,"Analysis complete. Your resume and result are saved to your account.","success");
    } catch(error){api.showMessage(notice,error.message||"Could not analyze this resume.","error");} finally{button.disabled=false;}
  });
});
