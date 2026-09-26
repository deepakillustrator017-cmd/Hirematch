(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", async function () {
    var api = window.hireInAI;
    if (!api || !api.client) return;
    var client = api.client;
    var notice = document.getElementById("jobMessage");
    var content = document.getElementById("jobContent");
    var match = location.pathname.match(/\/job\/([^/]+)/i);
    var jobId = new URLSearchParams(location.search).get("id") || (match && decodeURIComponent(match[1]));
    function escape(value) { return api.escapeHtml(value == null ? "" : value); }
    function setText(id, value) { document.getElementById(id).textContent = value || ""; }
    function setRichText(id, value) {
      var target = document.getElementById(id);
      var lines = Array.isArray(value) ? value : String(value || "").split(/\r?\n/).filter(Boolean);
      target.innerHTML = lines.length ? lines.map(function (line) { return "<p>" + escape(line) + "</p>"; }).join("") : "<p>Details will be shared by the employer.</p>";
    }
    if (!/^\d+$/.test(String(jobId || ""))) {
      api.showMessage(notice, "This job link is invalid. Browse jobs and try again.", "error");
      return;
    }
    try {
      var userResult = await client.auth.getUser();
      var user = userResult.data && userResult.data.user;
      var result = await client.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("This job is no longer available.");
      var job = result.data;
      var company = {};
      if (job.company_id) {
        try {
          var companyResult = await client.from("companies").select("name,description,website,logo_url,location").eq("id", job.company_id).maybeSingle();
          if (!companyResult.error && companyResult.data) company = companyResult.data;
        } catch (_) { /* Company profiles are optional until the schema migration is applied. */ }
      }
      var logo = job.logo || "/assets/imgs/theme/jobhub-logo.svg";
      var image = document.getElementById("jobLogo");
      image.src = /^https?:\/\//i.test(logo) ? logo : /^\/?assets\/[\w./-]+$/i.test(logo) ? "/" + logo.replace(/^\//, "") : "/assets/imgs/theme/jobhub-logo.svg";
      image.alt = (job.company || company.name || "Company") + " logo";
      setText("jobCategory", job.category || "Opportunity");
      setText("jobTitle", job.title || "Open role");
      setText("jobCompany", job.company || company.name || "Company");
      setText("jobBreadcrumb", job.title || "Job details");
      setRichText("jobDescription", job.description);
      setRichText("jobResponsibilities", job.responsibilities);
      setRichText("jobRequirements", job.requirements);
      setRichText("jobBenefits", job.benefits);
      ["responsibilities", "requirements", "benefits"].forEach(function (key) {
        document.getElementById(key + "Section").hidden = !job[key];
      });
      var skills = Array.isArray(job.skills) ? job.skills : String(job.skills || "").split(/[,\n]/).map(function (skill) { return skill.trim(); }).filter(Boolean);
      document.getElementById("skillsSection").hidden = !skills.length;
      document.getElementById("jobSkills").innerHTML = skills.map(function (skill) { return "<span>" + escape(skill) + "</span>"; }).join("");
      var metadata = [job.location || "Remote", job.work_mode || (/remote/i.test(job.location || "") ? "Remote" : "Onsite"), job.experience, job.employment_type || job.type || "Full time", job.posted_at ? "Posted " + new Date(job.posted_at).toLocaleDateString("en-IN") : "Recently posted"].filter(Boolean);
      document.getElementById("jobMeta").innerHTML = metadata.map(function (value) { return "<span>" + escape(value) + "</span>"; }).join("");
      setText("jobSalary", job.salary || "Salary not listed");
      setText("companyInfo", [company.description || ((job.company || company.name || "The employer") + " is hiring through HireIn AI."), company.website && "Website: " + company.website, company.location && "Location: " + company.location].filter(Boolean).join("\n"));
      document.getElementById("applyNow").href = "/apply?id=" + encodeURIComponent(job.id);
      document.title = (job.title || "Job details") + " at " + (job.company || company.name || "HireIn AI") + " | HireIn AI";
      document.querySelector("meta[name=description]").content = String(job.description || "Apply to " + job.title + " at " + job.company + " on HireIn AI.").slice(0, 160);
      document.getElementById("jobPostingSchema").textContent = JSON.stringify({
        "@context": "https://schema.org", "@type": "JobPosting", title: job.title,
        description: job.description, datePosted: job.posted_at || job.created_at,
        validThrough: job.expires_at || undefined, employmentType: job.employment_type || job.type || "FULL_TIME",
        hiringOrganization: { "@type": "Organization", name: job.company || company.name || "Employer", sameAs: company.website || undefined, logo: company.logo_url || undefined },
        jobLocationType: job.work_mode === "Remote" ? "TELECOMMUTE" : undefined,
        applicantLocationRequirements: job.work_mode === "Remote" ? { "@type": "Country", name: "India" } : undefined,
        jobLocation: job.work_mode === "Remote" ? undefined : { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location || undefined, addressCountry: "IN" } },
        baseSalary: job.salary_min ? { "@type": "MonetaryAmount", currency: job.currency || "INR", value: { "@type": "QuantitativeValue", minValue: job.salary_min, maxValue: job.salary_max || undefined, unitText: "YEAR" } } : undefined
      });
      content.hidden = false;
      api.showMessage(notice, "", "");
      var viewKey = "hirein-viewed-" + job.id + "-" + new Date().toISOString().slice(0, 10);
      try {
        if (!sessionStorage.getItem(viewKey)) {
          await client.from("job_views").insert({ job_id: Number(job.id), viewer_id: user ? user.id : null, session_id: sessionStorage.getItem("hirein-session") || crypto.randomUUID() });
          sessionStorage.setItem(viewKey, "1");
        }
      } catch (_) { /* View analytics must not block a job detail page. */ }
      var saveButton = document.getElementById("saveJob");
      saveButton.addEventListener("click", async function () {
        if (!user) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); return; }
        saveButton.disabled = true;
        var saved = await client.from("saved_jobs").insert({ user_id: user.id, job_id: Number(job.id) });
        if (saved.error && saved.error.code !== "23505") {
          api.showMessage(notice, saved.error.message, "error"); saveButton.disabled = false; return;
        }
        saveButton.textContent = "Saved";
      });
    } catch (error) {
      api.showMessage(notice, error.message || "Could not load this job.", "error");
    }
  });
})();
