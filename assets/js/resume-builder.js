document.addEventListener("DOMContentLoaded", async function () {
  var api = window.hireInAI, client = api && api.client;
  var form = document.getElementById("resumeForm");
  if (!client || !form) return;
  var notice = document.getElementById("resumeMessage");
  function missingColumn(error) { return error && (error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(error.message || "")); }
  var userResult = await client.auth.getUser(), user = userResult.data && userResult.data.user;
  if (!user) {
    api.showMessage(notice, "Sign in to save your resume and use AI writing tools.", "error");
    return;
  }
  if (user.email) form.elements.email.value = user.email;
  var profile = await api.getProfile(user.id);
  if (profile.data && profile.data.full_name) form.elements.full_name.value = profile.data.full_name;

  var definitions = {
    experience: [["role", "Role / title"], ["organization", "Company"], ["dates", "Dates"], ["details", "Achievements and responsibilities"]],
    project: [["name", "Project name"], ["link", "Project link"], ["details", "Project details"]],
    education: [["qualification", "Qualification"], ["organization", "School / institution"], ["dates", "Dates"], ["details", "Details"]],
    certificate: [["name", "Certificate"], ["organization", "Issuing organization"], ["date", "Date"]],
    language: [["name", "Language"], ["level", "Proficiency"]],
    link: [["name", "Link label"], ["url", "URL"]]
  };
  function addEntry(kind, values) {
    var target = document.getElementById(({experience:"experienceList",project:"projectList",education:"educationList",certificate:"certificateList",language:"languageList",link:"linkList"})[kind]);
    var card = document.createElement("fieldset"); card.className = "resume-entry";
    definitions[kind].forEach(function (field) {
      var label = document.createElement("label"); label.className = "field";
      var title = document.createElement("span"); title.textContent = field[1]; label.appendChild(title);
      var input = field[0] === "details" ? document.createElement("textarea") : document.createElement("input");
      input.name = field[0]; input.maxLength = field[0] === "details" ? 2500 : 500;
      if (field[0] === "details") input.rows = 3;
      input.value = values && values[field[0]] || ""; label.appendChild(input); card.appendChild(label);
    });
    var remove = document.createElement("button"); remove.type = "button"; remove.className = "small-button danger"; remove.textContent = "Remove";
    remove.addEventListener("click", function () { card.remove(); render(); }); card.appendChild(remove); target.appendChild(card); render();
  }
  function entries(id) { return Array.from(document.querySelectorAll("#" + id + " .resume-entry")).map(function (card) { var item = {}; card.querySelectorAll("input,textarea").forEach(function (field) { item[field.name] = field.value.trim(); }); return item; }).filter(function (item) { return Object.values(item).some(Boolean); }); }
  function data() {
    return { full_name:form.elements.full_name.value.trim(), email:form.elements.email.value.trim(), phone:form.elements.phone.value.trim(), location:form.elements.location.value.trim(), portfolio:form.elements.portfolio.value.trim(), linkedin:form.elements.linkedin.value.trim(), summary:form.elements.summary.value.trim(), experience:entries("experienceList"), projects:entries("projectList"), education:entries("educationList"), skills:form.elements.skills.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean), certificates:entries("certificateList"), languages:entries("languageList"), links:entries("linkList") };
  }
  function render() {
    var d = data(), preview = document.getElementById("resumePreview"), template = form.elements.template.value;
    preview.className = "resume-sheet template-" + template;
    function esc(v) { return api.escapeHtml(v); }
    function block(title, items, formatter) { var content = items.map(formatter).filter(Boolean).join(""); return content ? "<section><h2>"+title+"</h2>"+content+"</section>" : ""; }
    var contact = [d.email,d.phone,d.location,d.portfolio,d.linkedin].filter(Boolean).map(esc).join(" · ");
    preview.innerHTML = "<header><h1>"+esc(d.full_name || "Your Name")+"</h1><p>"+contact+"</p></header>" + (d.summary ? "<section><h2>Profile</h2><p>"+esc(d.summary)+"</p></section>" : "") +
      block("Experience",d.experience,function(x){return "<article><h3>"+esc(x.role)+"</h3><p class='resume-entry-meta'>"+esc(x.organization)+" · "+esc(x.dates)+"</p><p>"+esc(x.details)+"</p></article>";}) +
      block("Projects",d.projects,function(x){return "<article><h3>"+esc(x.name)+"</h3><p>"+esc(x.link)+"</p><p>"+esc(x.details)+"</p></article>";}) +
      block("Education",d.education,function(x){return "<article><h3>"+esc(x.qualification)+"</h3><p>"+esc(x.organization)+" · "+esc(x.dates)+"</p><p>"+esc(x.details)+"</p></article>";}) +
      (d.skills.length ? "<section><h2>Skills</h2><p>"+d.skills.map(esc).join(" · ")+"</p></section>" : "") +
      block("Certificates",d.certificates,function(x){return "<p><strong>"+esc(x.name)+"</strong> · "+esc(x.organization)+" · "+esc(x.date)+"</p>";}) +
      block("Languages",d.languages,function(x){return "<p>"+esc(x.name)+" · "+esc(x.level)+"</p>";}) +
      block("Links",d.links,function(x){return "<p>"+esc(x.name)+" · "+esc(x.url)+"</p>";});
  }
  form.addEventListener("input", render); form.elements.template.addEventListener("change", render);
  document.querySelectorAll("[data-add]").forEach(function (button) { button.addEventListener("click", function () { addEntry(button.dataset.kind); }); });
  addEntry("experience"); addEntry("education"); render();

  document.querySelectorAll("[data-ai]").forEach(function (button) { button.addEventListener("click", async function () {
    var service = window.HireInAIService, target = button.dataset.target;
    if (!service) { api.showMessage(notice,"AI service did not load. Refresh the page and try again.","error"); return; }
    button.disabled = true; api.showMessage(notice,"Working on your writing…","");
    try {
      var d = data(), input = {resume:d, text:target === "summary" ? d.summary : target === "skills" ? d.skills.join(", ") : d.experience.map(function (x) { return x.role+" at "+x.organization+"\n"+x.details; }).join("\n")};
      var result = await service.request(button.dataset.ai,input);
      if (target === "summary" && result.summary) form.elements.summary.value = result.summary;
      else if (target === "summary" && result.correctedText) form.elements.summary.value = result.correctedText;
      else if (target === "summary" && result.optimizedText) form.elements.summary.value = result.optimizedText;
      else if (target === "skills" && Array.isArray(result.skills)) form.elements.skills.value = result.skills.join(", ");
      else if (target === "experienceList" && Array.isArray(result.bullets) && d.experience.length) { var details = document.querySelectorAll("#experienceList textarea[name=details]"); if (details[0]) details[0].value = result.bullets.join("\n"); }
      else if (target === "experienceList" && Array.isArray(result.achievements) && result.achievements.length) { var boxes = document.querySelectorAll("#experienceList textarea[name=details]"); if (!boxes.length) { addEntry("experience"); boxes = document.querySelectorAll("#experienceList textarea[name=details]"); } boxes[0].value += (boxes[0].value ? "\n" : "") + result.achievements.map(function (value) { return value + " [verify and add your real result]"; }).join("\n"); }
      render(); api.showMessage(notice,"AI draft ready. Review it for accuracy before using it.","success");
    } catch (error) { api.showMessage(notice,error.message,"error"); } finally { button.disabled = false; }
  }); });
  document.getElementById("printResume").addEventListener("click", function () { render(); window.print(); });
  document.getElementById("downloadResume").addEventListener("click", async function () {
    var button = this, d = data(); if (!d.full_name) { api.showMessage(notice,"Add your full name before generating a PDF.","error"); return; }
    if (!window.html2pdf) { api.showMessage(notice,"PDF generator did not load. Check your connection and refresh.","error"); return; }
    render(); button.disabled = true; api.showMessage(notice,"Generating PDF and saving it to your dashboard…","");
    var path = user.id+"/builder/"+crypto.randomUUID()+".pdf", fileName = (form.elements.resume_name.value.trim() || "HireIn-AI-resume").replace(/[^a-zA-Z0-9_-]/g,"-")+".pdf";
    try {
      var previewNode=document.getElementById("resumePreview"),previousWidth=previewNode.style.width,blob;
      previewNode.style.width="794px";
      try { blob = await window.html2pdf().set({margin:10,filename:fileName,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true,windowWidth:794},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(previewNode).outputPdf("blob"); }
      finally { previewNode.style.width=previousWidth; }
      var upload = await client.storage.from("resumes").upload(path,blob,{contentType:"application/pdf",upsert:false}); if (upload.error) throw upload.error;
      var resumeRow={user_id:user.id,name:fileName,storage_path:path,pdf_url:path,template:form.elements.template.value,resume_data:d};
      var row = await client.from("resumes").insert(resumeRow);
      if(row.error&&missingColumn(row.error)){delete resumeRow.pdf_url;delete resumeRow.template;delete resumeRow.resume_data;row=await client.from("resumes").insert(resumeRow);}
      if (row.error) { await client.storage.from("resumes").remove([path]); throw row.error; }
      var link = document.createElement("a"),downloadUrl=URL.createObjectURL(blob); link.href=downloadUrl; link.download=fileName; link.click(); setTimeout(function(){URL.revokeObjectURL(downloadUrl);},1000);
      api.showMessage(notice,"PDF downloaded and saved to your dashboard.","success");
    } catch (error) { api.showMessage(notice,error.message || "Could not save the PDF.","error"); } finally { button.disabled=false; }
  });
});
