(function () {
  "use strict";
  var ACTIONS = new Set(["generateSummary", "improveExperience", "generateAchievements", "grammarCorrection", "atsOptimize", "suggestSkills", "extractKeywords", "analyzeATS"]);
  function request(action, input) {
    var api = window.hireInAI;
    if (!api || !api.client) return Promise.reject(new Error("Sign in before using HireIn AI tools."));
    if (!ACTIONS.has(action)) return Promise.reject(new Error("This AI action is not supported."));
    return api.client.functions.invoke("ai-assistant", { body: { action: action, input: input || {} } }).then(function (result) {
      if (result.error) {
        var details = result.error.context && result.error.context.json ? result.error.context.json() : null;
        return Promise.resolve(details).catch(function () { return null; }).then(function (body) {
          throw new Error(body && body.error || result.error.message || "AI service is unavailable.");
        });
      }
      var data = result.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("AI returned an invalid response. Please retry.");
      return data;
    });
  }
  function action(name) { return function (input) { return request(name, input); }; }
  window.HireInAIService = {
    request: request,
    actions: ACTIONS,
    generateSummary: action("generateSummary"),
    improveExperience: action("improveExperience"),
    generateAchievements: action("generateAchievements"),
    grammarCorrection: action("grammarCorrection"),
    atsOptimize: action("atsOptimize"),
    extractKeywords: action("extractKeywords"),
    calculateATS: action("calculateATS"),
    suggestSkills: action("suggestSkills")
  };
})();
