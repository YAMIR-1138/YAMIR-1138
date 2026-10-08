/**
 * chooser.js - "which test do I use". A short dynamic questionnaire and a
 * catalog of tests. questions(answers) says what to ask next;
 * recommend(answers) returns the pick once enough is known.
 *
 * Every catalog entry has: name, use, assumptions, effect (what effect
 * size to report), report (a sentence template), r and py (code), and
 * optionally alt (the usual fallback) and notes.
 */

export const TESTS = {
    one_sample_t: {
        name: 'One-sample t test',
        use: 'Is the mean of one group different from a known value (a reference, a target, zero)?',
        assumptions: ['Observations independent', 'Roughly normal, or n large enough for the mean to be (≳ 30 without heavy skew)'],
        effect: 'Mean difference with 95% CI; Cohen’s d = (mean − μ₀)/SD',
        report: 'Mean 4.3 (SD 1.1) vs reference 4.0; difference 0.3 (95% CI 0.05 to 0.55), t(24) = 2.5, p = 0.02.',
        r: 't.test(x, mu = 4)',
        py: 'from scipy import stats\nstats.ttest_1samp(x, popmean=4)',
        alt: 'wilcoxon_one',
    },
    wilcoxon_one: {
        name: 'Wilcoxon signed-rank test (one sample)',
        use: 'Is the median of one group different from a known value, without assuming normality?',
        assumptions: ['Observations independent', 'Distribution symmetric around its median (otherwise use the sign test)'],
        effect: 'Median with CI (Hodges–Lehmann); r = Z/√n',
        report: 'Median 4.2 (IQR 3.6 to 4.9) vs 4.0; Wilcoxon signed-rank V = 210, p = 0.03.',
        r: 'wilcox.test(x, mu = 4, conf.int = TRUE)',
        py: 'from scipy import stats\nstats.wilcoxon(x - 4)',
    },
    welch_t: {
        name: 'Welch’s t test (two independent groups)',
        use: 'Do two independent groups differ in their means? Welch’s version does not assume equal variances and is the sensible default (R’s t.test already uses it).',
        assumptions: ['Observations independent, groups independent', 'Each group roughly normal, or n ≳ 30 per group', 'Does not need equal variances'],
        effect: 'Difference in means with 95% CI; Cohen’s d or Hedges’ g',
        report: 'Mean 12.1 (SD 3.0) vs 10.4 (SD 2.7); difference 1.7 (95% CI 0.4 to 3.0), Welch t(57.2) = 2.6, p = 0.01, d = 0.6.',
        r: 't.test(y ~ group, data = d)        # Welch by default\neffectsize::cohens_d(y ~ group, data = d)',
        py: 'from scipy import stats\nstats.ttest_ind(a, b, equal_var=False)',
        alt: 'mann_whitney',
        notes: 'Student’s t (equal variances) is only worth it with very small, balanced groups. Never pick it based on an F test of variances first.',
    },
    mann_whitney: {
        name: 'Mann–Whitney U test (Wilcoxon rank-sum)',
        use: 'Do two independent groups differ, when the outcome is skewed, ordinal, or has outliers?',
        assumptions: ['Observations independent', 'Tests whether one group tends to have larger values (stochastic dominance); equals a test of medians only if the shapes match'],
        effect: 'Probability of superiority (AUC = U/(n₁n₂)); Hodges–Lehmann shift with CI; r = Z/√N',
        report: 'Median 11 (IQR 8 to 15) vs 9 (IQR 6 to 12); Mann–Whitney U = 812, p = 0.02; P(superiority) = 0.64.',
        r: 'wilcox.test(y ~ group, data = d, conf.int = TRUE)',
        py: 'from scipy import stats\nstats.mannwhitneyu(a, b, alternative="two-sided")',
        notes: 'Not a “test of medians” in general. With small n it cannot give p < 0.05 at all below about 4 per group.',
    },
    paired_t: {
        name: 'Paired t test',
        use: 'Before vs after, or two measurements on the same unit: is the mean difference zero?',
        assumptions: ['Pairs independent of each other', 'The differences (not the raw values) roughly normal, or n ≳ 30 pairs'],
        effect: 'Mean of the differences with 95% CI; d_z = mean diff / SD of diffs (say which d you used)',
        report: 'Mean change −2.1 (SD 3.4; 95% CI −3.2 to −1.0), paired t(39) = −3.9, p < 0.001.',
        r: 't.test(after, before, paired = TRUE)',
        py: 'from scipy import stats\nstats.ttest_rel(after, before)',
        alt: 'wilcoxon_paired',
    },
    wilcoxon_paired: {
        name: 'Wilcoxon signed-rank test (paired)',
        use: 'Paired data where the differences are skewed or ordinal.',
        assumptions: ['Pairs independent', 'Differences symmetric around the median (otherwise sign test)'],
        effect: 'Median difference with CI (Hodges–Lehmann); r = Z/√n',
        report: 'Median change −1.5 (IQR −3 to 0); Wilcoxon signed-rank V = 120, p = 0.004.',
        r: 'wilcox.test(after, before, paired = TRUE, conf.int = TRUE)',
        py: 'from scipy import stats\nstats.wilcoxon(after, before)',
    },
    anova: {
        name: 'One-way ANOVA (Welch) + post-hoc',
        use: 'Do three or more independent groups differ in their means? Then which ones (post-hoc)?',
        assumptions: ['Observations independent', 'Each group roughly normal, or groups large', 'Welch’s ANOVA drops the equal-variance assumption; use Games–Howell post-hoc with it, Tukey HSD with classic ANOVA'],
        effect: 'η² or ω² overall; pairwise differences with CIs',
        report: 'Welch F(2, 41.3) = 5.8, p = 0.006, ω² = 0.12. Games–Howell: A vs C 3.1 (95% CI 0.8 to 5.4), p = 0.004; other pairs not significant.',
        r: 'oneway.test(y ~ group, data = d)          # Welch\nrstatix::games_howell_test(d, y ~ group)\n# classic: aov(y ~ group, d) |> TukeyHSD()',
        py: 'import pingouin as pg\npg.welch_anova(data=d, dv="y", between="group")\npg.pairwise_gameshowell(data=d, dv="y", between="group")',
        alt: 'kruskal',
        notes: 'If the groups are ordered doses, a trend test or regression on dose is usually a better question than “any difference”.',
    },
    kruskal: {
        name: 'Kruskal–Wallis test + Dunn’s post-hoc',
        use: 'Three or more independent groups, skewed or ordinal outcome.',
        assumptions: ['Observations independent', 'Same caveat as Mann–Whitney about shapes'],
        effect: 'ε² (epsilon squared); pairwise Dunn tests with Holm or BH adjustment',
        report: 'Kruskal–Wallis H(2) = 9.4, p = 0.009, ε² = 0.11. Dunn (Holm): A vs C p = 0.01.',
        r: 'kruskal.test(y ~ group, data = d)\nrstatix::dunn_test(d, y ~ group, p.adjust.method = "holm")',
        py: 'from scipy import stats\nstats.kruskal(a, b, c)\nimport scikit_posthocs as sp; sp.posthoc_dunn(d, val_col="y", group_col="group", p_adjust="holm")',
    },
    rm_anova: {
        name: 'Repeated-measures ANOVA, or a linear mixed model',
        use: 'The same units measured under three or more conditions or time points.',
        assumptions: ['Sphericity for RM-ANOVA (Greenhouse–Geisser corrects it); a mixed model does not need it and tolerates missing time points'],
        effect: 'Partial η² or generalized η²; condition contrasts with CIs',
        report: 'Time effect F(1.6, 46.1) = 8.2 (Greenhouse–Geisser), p = 0.002, η²_G = 0.09.',
        r: 'afex::aov_ez(id = "id", dv = "y", within = "time", data = d)\n# mixed model (preferred with missing data):\nlme4::lmer(y ~ time + (1 | id), data = d)',
        py: 'import pingouin as pg\npg.rm_anova(data=d, dv="y", within="time", subject="id")\nimport statsmodels.formula.api as smf\nsmf.mixedlm("y ~ time", d, groups=d["id"]).fit()',
        alt: 'friedman',
    },
    friedman: {
        name: 'Friedman test',
        use: 'Three or more related conditions, ordinal or non-normal outcome, complete blocks.',
        assumptions: ['Each unit measured in every condition (no missing cells)'],
        effect: 'Kendall’s W; pairwise Wilcoxon or Nemenyi post-hoc',
        report: 'Friedman χ²(2) = 11.2, p = 0.004, Kendall’s W = 0.28.',
        r: 'friedman.test(y ~ condition | id, data = d)',
        py: 'from scipy import stats\nstats.friedmanchisquare(c1, c2, c3)',
    },
    pearson: {
        name: 'Pearson correlation',
        use: 'How strongly are two continuous variables linearly related?',
        assumptions: ['Pairs independent', 'Linear relationship', 'For the p-value and CI: bivariate normality, or n large; sensitive to outliers'],
        effect: 'r with 95% CI (Fisher z); r²',
        report: 'r = 0.42 (95% CI 0.18 to 0.61), n = 60, p < 0.001.',
        r: 'cor.test(x, y)',
        py: 'from scipy import stats\nstats.pearsonr(x, y)   # .confidence_interval() in recent SciPy',
        alt: 'spearman',
        notes: 'Always plot it. Correlation says nothing about agreement or slope: two methods can correlate at 0.99 and disagree by a factor of two.',
    },
    spearman: {
        name: 'Spearman’s ρ (or Kendall’s τ)',
        use: 'Monotonic association between two variables, either of which may be ordinal, skewed, or have outliers.',
        assumptions: ['Pairs independent', 'Monotonic (not necessarily linear) relationship'],
        effect: 'ρ with bootstrap CI; Kendall’s τ is preferable with many ties or small n',
        report: 'Spearman ρ = 0.38, n = 60, p = 0.003.',
        r: 'cor.test(x, y, method = "spearman")\ncor.test(x, y, method = "kendall")',
        py: 'from scipy import stats\nstats.spearmanr(x, y); stats.kendalltau(x, y)',
    },
    linear_reg: {
        name: 'Linear regression (OLS)',
        use: 'Model a continuous outcome with one or more predictors; adjust for covariates; estimate slopes.',
        assumptions: ['Independent observations', 'Linear in the parameters (transform or use splines for curves)', 'Residuals roughly normal with constant variance (check plots; robust SEs fix heteroscedasticity)', 'No extreme collinearity'],
        effect: 'β per unit (or per SD) with 95% CI; R²',
        report: 'Each year of age was associated with 0.8 mmHg higher SBP (95% CI 0.5 to 1.1, p < 0.001), adjusted for sex and BMI; R² = 0.31.',
        r: 'fit <- lm(y ~ x1 + x2, data = d); summary(fit); confint(fit)\n# robust SEs: lmtest::coeftest(fit, vcov = sandwich::vcovHC(fit))',
        py: 'import statsmodels.formula.api as smf\nfit = smf.ols("y ~ x1 + x2", data=d).fit(cov_type="HC3")\nfit.summary()',
        notes: 'A t test is a linear regression with one binary predictor; ANOVA is one with a categorical predictor. Thinking in models scales better than thinking in tests.',
    },
    lmm: {
        name: 'Linear mixed model',
        use: 'Continuous outcome with repeated measures or clustering (patients in hospitals, cells in mice, replicates in batches).',
        assumptions: ['Random effects capture the clustering; specify the structure that matches the design', 'Residuals normal-ish within clusters'],
        effect: 'Fixed-effect β with CI; ICC to say how much variance is between clusters',
        report: 'Treatment increased the outcome by 2.4 units (95% CI 1.1 to 3.7, p < 0.001) in a mixed model with random intercepts for mouse (ICC = 0.35).',
        r: 'lme4::lmer(y ~ treatment + time + (1 | mouse), data = d)\nlmerTest::lmer(...)   # adds p-values\nperformance::icc(fit)',
        py: 'import statsmodels.formula.api as smf\nsmf.mixedlm("y ~ treatment + time", d, groups=d["mouse"]).fit()',
        notes: 'Treating 30 cells from 3 mice as n = 30 is pseudoreplication. The mouse is the unit; this model knows that.',
    },
    binom_test: {
        name: 'Exact binomial test',
        use: 'Is one proportion different from a known value (e.g. 50%, or a population rate)?',
        assumptions: ['Independent trials with the same probability'],
        effect: 'Proportion with exact (Clopper–Pearson) or Wilson CI',
        report: '31 of 50 (62%, 95% CI 47% to 75%) vs the expected 50%, exact binomial p = 0.12.',
        r: 'binom.test(31, 50, p = 0.5)\nprop.test(31, 50, p = 0.5)   # Wilson-type CI',
        py: 'from scipy import stats\nstats.binomtest(31, 50, p=0.5)',
    },
    chisq_2x2: {
        name: 'Chi-square test (2×2), or Fisher’s exact',
        use: 'Are two proportions different? Is a binary outcome associated with a binary group?',
        assumptions: ['Independent observations (each person counted once)', 'Chi-square: expected counts ≥ 5 in every cell; otherwise Fisher’s exact test'],
        effect: 'Risk difference, risk ratio, odds ratio, each with 95% CI; NNT',
        report: '18/60 (30%) vs 9/60 (15%); risk difference 15 pp (95% CI 0.6 to 29), RR 2.0 (95% CI 1.0 to 4.1), χ²(1) = 3.9, p = 0.05.',
        r: 'tab <- table(d$group, d$outcome)\nchisq.test(tab, correct = FALSE)\nfisher.test(tab)\nepitools::riskratio(tab); epitools::oddsratio(tab)',
        py: 'from scipy import stats\nstats.chi2_contingency(tab, correction=False)\nstats.fisher_exact(tab)',
        notes: 'Yates’ continuity correction is conservative; most statisticians now turn it off. Report the proportions and their difference, not just p.',
    },
    mcnemar: {
        name: 'McNemar’s test',
        use: 'Paired binary data: did the same people switch from negative to positive more often than the reverse (before/after, two tests on the same samples)?',
        assumptions: ['Pairs independent', 'Only the discordant pairs carry information'],
        effect: 'Difference in paired proportions with CI; ratio of discordant counts',
        report: '12 switched to positive and 3 to negative (of 80 pairs); McNemar χ²(1) = 4.3, p = 0.04; difference 11 pp (95% CI 1 to 21).',
        r: 'mcnemar.test(tab)          # tab is the 2×2 of paired outcomes\nexact2x2::exact2x2(tab, paired = TRUE)',
        py: 'from statsmodels.stats.contingency_tables import mcnemar\nmcnemar(tab, exact=True)',
    },
    chisq_rxc: {
        name: 'Chi-square test of independence (r×c)',
        use: 'Is a categorical outcome distributed differently across three or more groups (or two categorical variables associated)?',
        assumptions: ['Independent observations', 'Expected counts ≥ 5 in ≥ 80% of cells; otherwise Fisher–Freeman–Halton (exact) or simulate'],
        effect: 'Cramér’s V; standardized residuals to see which cells drive it; pairwise comparisons with adjustment',
        report: 'χ²(4) = 14.2, p = 0.007, Cramér’s V = 0.19. Standardized residuals: group C had more severe cases than expected (z = 2.8).',
        r: 'chisq.test(tab); chisq.test(tab, simulate.p.value = TRUE)\nfisher.test(tab, workspace = 2e7)\nrstatix::cramer_v(tab)',
        py: 'from scipy import stats\nstats.chi2_contingency(tab)\nfrom scipy.stats.contingency import association; association(tab, method="cramer")',
    },
    cochran_q: {
        name: 'Cochran’s Q test',
        use: 'Binary outcome measured on the same units under three or more conditions (McNemar for k conditions).',
        assumptions: ['Units independent', 'Complete blocks'],
        effect: 'Proportions per condition; post-hoc pairwise McNemar with adjustment',
        report: 'Positive rate 20%, 35%, 50% across the three protocols; Cochran’s Q(2) = 9.8, p = 0.007.',
        r: 'rstatix::cochran_qtest(d, y ~ condition | id)',
        py: 'from statsmodels.stats.contingency_tables import cochrans_q\ncochrans_q(X)   # rows = subjects, columns = conditions',
    },
    logistic_reg: {
        name: 'Logistic regression',
        use: 'Model a binary outcome with one or more predictors; adjust for confounders; get odds ratios.',
        assumptions: ['Independent observations', 'Log-odds linear in continuous predictors (check with splines)', 'Enough events: roughly ≥ 10 to 20 events per predictor', 'No separation (Firth’s correction if a predictor perfectly predicts)'],
        effect: 'Odds ratio per unit with 95% CI; marginal risk differences if you want something interpretable (see the OR converter)',
        report: 'Each 10-year increase in age was associated with 1.6 times the odds of the outcome (OR 1.6, 95% CI 1.2 to 2.1, p = 0.001), adjusted for sex and smoking.',
        r: 'fit <- glm(y ~ x1 + x2, family = binomial, data = d)\nexp(cbind(OR = coef(fit), confint(fit)))\n# rare outcome or separation: logistf::logistf(...)\n# risk ratios directly: glm(..., family = poisson) with sandwich SEs',
        py: 'import statsmodels.formula.api as smf\nfit = smf.logit("y ~ x1 + x2", data=d).fit()\nimport numpy as np; np.exp(fit.params), np.exp(fit.conf_int())',
    },
    glmm_binary: {
        name: 'Mixed-effects logistic regression (GLMM) or GEE',
        use: 'Binary outcome with repeated measures or clustering.',
        assumptions: ['GLMM: subject-specific (conditional) ORs; GEE: population-averaged ORs. They answer different questions and give different numbers', 'Enough clusters (≳ 10 to 20) to estimate the variance'],
        effect: 'OR with CI; say whether it is conditional or marginal',
        report: 'Odds of response were 2.3 times higher on treatment (OR 2.3, 95% CI 1.4 to 3.8) in a mixed logistic model with random intercepts for patient.',
        r: 'lme4::glmer(y ~ treatment + (1 | id), family = binomial, data = d)\ngeepack::geeglm(y ~ treatment, id = id, family = binomial, corstr = "exchangeable", data = d)',
        py: 'import statsmodels.api as sm, statsmodels.formula.api as smf\nsmf.gee("y ~ treatment", groups="id", data=d, family=sm.families.Binomial()).fit()',
    },
    multinomial_reg: {
        name: 'Multinomial logistic regression',
        use: 'Outcome with three or more unordered categories, modelled with predictors.',
        assumptions: ['Independent observations', 'Independence of irrelevant alternatives (removing a category should not change the others’ ratios)'],
        effect: 'Relative risk ratios (relative to the reference category) with CIs',
        report: 'Relative to type A, each unit of x raised the relative risk of type B by 30% (RRR 1.3, 95% CI 1.1 to 1.5).',
        r: 'nnet::multinom(y ~ x1 + x2, data = d)',
        py: 'import statsmodels.formula.api as smf\nsmf.mnlogit("y ~ x1 + x2", data=d).fit()',
    },
    ordinal_reg: {
        name: 'Ordinal logistic regression (proportional odds)',
        use: 'Ordered categorical outcome (grade 1 to 4, Likert, severity) modelled with predictors.',
        assumptions: ['Independent observations', 'Proportional odds: the same OR for every cut-point (test it; partial proportional odds models relax it)'],
        effect: 'Common odds ratio with CI: the odds of being in a higher category',
        report: 'Treatment doubled the odds of a better outcome category (common OR 2.0, 95% CI 1.3 to 3.1, p = 0.002); the proportional-odds assumption was not rejected (p = 0.4).',
        r: 'MASS::polr(factor(y) ~ x1 + x2, data = d, Hess = TRUE)\nordinal::clm(factor(y) ~ x1 + x2, data = d)',
        py: 'from statsmodels.miscmodels.ordinal_model import OrderedModel\nOrderedModel(d["y"], d[["x1", "x2"]], distr="logit").fit()',
    },
    poisson_reg: {
        name: 'Poisson or negative binomial regression',
        use: 'Count outcome (events, colonies, lesions, reads) modelled with predictors, often per unit of exposure.',
        assumptions: ['Independent counts', 'Poisson: variance = mean. Real data are nearly always overdispersed; then use negative binomial (or quasi-Poisson)', 'Use an offset (log exposure) for rates', 'Many zeros beyond what the model predicts: zero-inflated or hurdle model'],
        effect: 'Rate ratio (incidence rate ratio) per unit with CI',
        report: 'The event rate was 40% lower on treatment (IRR 0.60, 95% CI 0.45 to 0.80, p < 0.001) in a negative binomial model with follow-up time as offset.',
        r: 'glm(count ~ treatment + offset(log(time)), family = poisson, data = d)\nMASS::glm.nb(count ~ treatment + offset(log(time)), data = d)\nAER::dispersiontest(fit)',
        py: 'import statsmodels.formula.api as smf\nsmf.glm("count ~ treatment", data=d, family=sm.families.NegativeBinomial(), offset=np.log(d["time"])).fit()',
        notes: 'RNA-seq counts: do not fit this gene by gene yourself. DESeq2, edgeR and limma-voom are negative binomial (or precision-weighted linear) models with shrinkage built for exactly that.',
    },
    count_two: {
        name: 'Two-group count comparison',
        use: 'Compare counts (colonies, events, cells per field) between two independent groups.',
        assumptions: ['Independent counts', 'The groups have comparable exposure, or you use an offset'],
        effect: 'Rate ratio with CI',
        report: 'Mean 12.4 vs 7.1 colonies per plate; rate ratio 1.75 (95% CI 1.3 to 2.4), negative binomial model, p < 0.001.',
        r: 'MASS::glm.nb(count ~ group, data = d)     # rate ratio = exp(coef)\n# or, pragmatic with few samples: wilcox.test(count ~ group, data = d)',
        py: 'import statsmodels.formula.api as smf\nsmf.glm("count ~ group", data=d, family=sm.families.NegativeBinomial()).fit()',
        alt: 'mann_whitney',
        notes: 'A t test on counts is often fine when counts are large (≳ 20). For small counts the variance depends on the mean, which a t test ignores.',
    },
    exact_poisson: {
        name: 'Exact Poisson test',
        use: 'Is an observed count or rate different from an expected one (e.g. observed vs expected cases)?',
        assumptions: ['Events independent and at a constant rate'],
        effect: 'Rate ratio (observed/expected) with exact CI',
        report: '14 cases observed vs 8.2 expected; SIR 1.7 (95% CI 0.9 to 2.9), p = 0.07.',
        r: 'poisson.test(14, T = 8.2)   # T is the expected count (or person-time with r)',
        py: 'from scipy import stats\nstats.poisson.sf(13, 8.2) * 2   # crude two-sided',
    },
    logrank: {
        name: 'Log-rank test with Kaplan–Meier curves',
        use: 'Do two or more groups differ in time to an event, with censoring?',
        assumptions: ['Non-informative censoring', 'Hazards roughly proportional (if curves cross, log-rank loses power; consider restricted mean survival time)'],
        effect: 'Hazard ratio from Cox with CI; median survival per group; survival at a landmark time; RMST difference',
        report: 'Median survival 18 vs 11 months; HR 0.62 (95% CI 0.45 to 0.86), log-rank p = 0.004.',
        r: 'library(survival)\nsurvdiff(Surv(time, event) ~ group, data = d)\nsurvfit(Surv(time, event) ~ group, data = d)   # medians, curves\ncoxph(Surv(time, event) ~ group, data = d)     # for the HR',
        py: 'from lifelines.statistics import logrank_test\nfrom lifelines import KaplanMeierFitter\nlogrank_test(t1, t2, event_observed_A=e1, event_observed_B=e2)',
        notes: 'Do not compare the fraction with an event at the end: that throws away censoring. If the “event” has competitors (death before relapse), use competing-risks methods (cumulative incidence, Fine–Gray).',
    },
    cox: {
        name: 'Cox proportional-hazards regression',
        use: 'Time-to-event outcome with predictors; adjusted hazard ratios.',
        assumptions: ['Proportional hazards for each covariate (check Schoenfeld residuals; stratify or add time interactions if violated)', 'Non-informative censoring', 'Log-linear effect of continuous predictors', 'Roughly ≥ 10 events per predictor'],
        effect: 'Hazard ratio per unit with 95% CI (see the HR converter for what it means)',
        report: 'Adjusted for age and stage, treatment halved the hazard of death (HR 0.52, 95% CI 0.36 to 0.75, p < 0.001); proportional hazards held (global Schoenfeld p = 0.3).',
        r: 'library(survival)\nfit <- coxph(Surv(time, event) ~ treatment + age + stage, data = d)\ncox.zph(fit)   # PH check\n# clustered: coxph(... + cluster(id)) or + frailty(id)\n# competing risks: cmprsk::crr() or tidycmprsk',
        py: 'from lifelines import CoxPHFitter\ncph = CoxPHFitter().fit(d, duration_col="time", event_col="event")\ncph.check_assumptions(d)',
    },
    kappa: {
        name: 'Cohen’s kappa (weighted for ordinal)',
        use: 'Agreement between two raters or methods on a categorical rating, beyond chance.',
        assumptions: ['Same categories for both raters', 'Kappa depends on prevalence: report the raw agreement too'],
        effect: 'κ with 95% CI (quadratic weights for ordinal scales); Fleiss’ or Krippendorff’s α for > 2 raters',
        report: 'Raters agreed on 84% of cases, κ = 0.71 (95% CI 0.60 to 0.82).',
        r: 'irr::kappa2(ratings, weight = "squared")\npsych::cohen.kappa(ratings)',
        py: 'from sklearn.metrics import cohen_kappa_score\ncohen_kappa_score(r1, r2, weights="quadratic")',
    },
    icc: {
        name: 'Intraclass correlation + Bland–Altman plot',
        use: 'Agreement between two methods or raters on a continuous measurement; test-retest reliability.',
        assumptions: ['Choose the ICC form that matches the design (one-way vs two-way, agreement vs consistency, single vs average measures)', 'Bland–Altman: differences roughly constant across the measurement range (otherwise log-transform)'],
        effect: 'ICC with 95% CI; mean bias and 95% limits of agreement',
        report: 'ICC(2,1) = 0.88 (95% CI 0.80 to 0.93). Mean bias 0.4 units (limits of agreement −2.1 to 2.9).',
        r: 'psych::ICC(wide_matrix)\nblandr::blandr.statistics(m1, m2)   # or compute: mean(d) ± 1.96*sd(d)',
        py: 'import pingouin as pg\npg.intraclass_corr(data=long, targets="id", raters="method", ratings="y")',
        notes: 'Correlation is not agreement. Two methods can have r = 0.99 and differ by a constant 20%.',
    },
};

/**
 * The questionnaire. Each option is [value, label, hint]. Questions appear
 * in order and depend on earlier answers; unanswered later questions are
 * simply not shown yet.
 */
export function questions(a) {
    const qs = [];
    qs.push({
        key: 'goal', label: 'What are you trying to do?',
        options: [
            ['compare', 'Compare groups or conditions', 'treated vs control, before vs after, three doses'],
            ['assoc', 'Measure the association between two variables', 'does x go with y'],
            ['model', 'Model an outcome with several predictors', 'adjust for covariates, get effect estimates'],
            ['agree', 'Check agreement or reliability', 'two raters, two methods, test-retest'],
        ],
    });
    if (!a.goal) return qs;
    qs.push({
        key: 'outcome', label: a.goal === 'agree' ? 'What is being rated or measured?' : 'What kind of thing is the outcome (dependent variable)?',
        options: [
            ['continuous', 'Continuous', 'concentration, weight, expression level, score'],
            ['binary', 'Binary', 'yes/no, dead/alive, responder/non-responder'],
            ['categorical', 'Categorical, unordered, 3+ levels', 'subtype, genotype, blood group'],
            ['ordinal', 'Ordinal', 'grade I to IV, Likert, mild/moderate/severe'],
            ['count', 'A count', 'colonies, events per patient, cells per field'],
            ['time', 'Time to an event, with censoring', 'survival, time to relapse'],
        ].filter(o => a.goal !== 'agree' || ['continuous', 'binary', 'categorical', 'ordinal'].includes(o[0])),
    });
    if (!a.outcome) return qs;

    if (a.goal === 'compare') {
        if (a.outcome === 'time') {
            qs.push({ key: 'groups', label: 'How many groups?', options: [['two', 'Two'], ['many', 'Three or more']] });
            return qs;
        }
        qs.push({
            key: 'groups', label: 'How many groups or conditions?',
            options: [['one', 'One, against a known value', 'is the mean 0, is the rate 50%'], ['two', 'Two'], ['many', 'Three or more']],
        });
        if (!a.groups || a.groups === 'one') {
            if (a.groups === 'one' && a.outcome === 'continuous') qs.push(distQuestion());
            return qs;
        }
        qs.push({
            key: 'design', label: 'Are the groups independent, or the same units measured repeatedly?',
            options: [['indep', 'Independent', 'different people, animals or samples in each group'], ['paired', 'Paired or repeated', 'before/after, matched pairs, same subject in every condition']],
        });
        if (!a.design) return qs;
        if (a.outcome === 'continuous') qs.push(distQuestion());
        return qs;
    }

    if (a.goal === 'assoc') {
        qs.push({
            key: 'predictor', label: 'And the other variable?',
            options: [['continuous', 'Continuous'], ['binary', 'Binary (two groups)'], ['categorical', 'Categorical or ordinal']],
        });
        if (!a.predictor) return qs;
        if (a.outcome === 'continuous' && a.predictor === 'continuous') qs.push(distQuestion('Do both look roughly linear and normal-ish, without outliers?'));
        return qs;
    }

    if (a.goal === 'model') {
        qs.push({
            key: 'design', label: 'Is each unit measured once, or are there repeated measures or clusters?',
            options: [['indep', 'Once, independent', 'one row per patient / sample'], ['paired', 'Repeated or clustered', 'longitudinal, cells within mice, patients within centres']],
        });
        return qs;
    }

    return qs; // agree: outcome is enough
}

function distQuestion(label) {
    return {
        key: 'dist', label: label || 'What does the outcome look like within each group?',
        options: [
            ['normal', 'Roughly bell-shaped, or n ≳ 30 per group', 'parametric tests are fine'],
            ['skewed', 'Skewed, outliers, bounded, or small n', 'rank-based tests, or transform first'],
            ['unsure', 'Not sure', 'plot it; meanwhile the parametric pick with its rank-based alternative'],
        ],
    };
}

/** True when every question that would be shown has an answer. */
export function complete(a) {
    return questions(a).every(q => a[q.key]);
}

/**
 * The recommendation: { primary, alternatives, notes } with catalog keys,
 * or null while the questionnaire is incomplete.
 */
export function recommend(a) {
    if (!complete(a)) return null;
    const notes = [];
    const pick = (primary, ...alternatives) => ({ primary, alternatives: alternatives.filter(Boolean), notes });
    const nonparam = a.dist === 'skewed';
    const { goal, outcome } = a;

    if (goal === 'agree') {
        if (outcome === 'continuous') return pick('icc', 'pearson');
        if (outcome === 'ordinal') { notes.push('Use quadratic weights so near-misses count for something.'); return pick('kappa'); }
        return pick('kappa');
    }

    if (goal === 'compare') {
        const { groups, design } = a;
        if (outcome === 'continuous') {
            if (groups === 'one') return nonparam ? pick('wilcoxon_one', 'one_sample_t') : pick('one_sample_t', 'wilcoxon_one');
            if (groups === 'two') {
                if (design === 'paired') return nonparam ? pick('wilcoxon_paired', 'paired_t') : pick('paired_t', 'wilcoxon_paired');
                return nonparam ? pick('mann_whitney', 'welch_t') : pick('welch_t', 'mann_whitney');
            }
            if (design === 'paired') return nonparam ? pick('friedman', 'rm_anova') : pick('rm_anova', 'friedman', 'lmm');
            return nonparam ? pick('kruskal', 'anova') : pick('anova', 'kruskal', 'linear_reg');
        }
        if (outcome === 'binary') {
            if (groups === 'one') return pick('binom_test');
            if (groups === 'two') return design === 'paired' ? pick('mcnemar') : pick('chisq_2x2', 'logistic_reg');
            return design === 'paired' ? pick('cochran_q', 'glmm_binary') : pick('chisq_rxc', 'logistic_reg');
        }
        if (outcome === 'categorical') {
            if (groups === 'one') { notes.push('Compare the observed distribution to the expected one with a chi-square goodness-of-fit test: chisq.test(counts, p = expected).'); return pick('chisq_rxc'); }
            if (design === 'paired') { notes.push('For paired nominal data with 3+ categories, use the Stuart–Maxwell (marginal homogeneity) test: rstatix or DescTools::StuartMaxwellTest.'); return pick('mcnemar', 'multinomial_reg'); }
            return pick('chisq_rxc', 'multinomial_reg');
        }
        if (outcome === 'ordinal') {
            if (groups === 'one') return pick('wilcoxon_one');
            if (groups === 'two') return design === 'paired' ? pick('wilcoxon_paired') : pick('mann_whitney', 'ordinal_reg');
            return design === 'paired' ? pick('friedman') : pick('kruskal', 'ordinal_reg');
        }
        if (outcome === 'count') {
            if (groups === 'one') return pick('exact_poisson');
            if (design === 'paired') { notes.push('Paired counts: a mixed Poisson/negative-binomial model with a random intercept per unit (lme4::glmer.nb), or Wilcoxon signed-rank on the paired differences as a pragmatic fallback.'); return pick('poisson_reg', 'wilcoxon_paired'); }
            if (groups === 'two') return pick('count_two', 'poisson_reg');
            return pick('poisson_reg', 'kruskal');
        }
        if (outcome === 'time') return pick('logrank', 'cox');
    }

    if (goal === 'assoc') {
        const { predictor } = a;
        if (outcome === 'continuous') {
            if (predictor === 'continuous') return nonparam ? pick('spearman', 'pearson', 'linear_reg') : pick('pearson', 'spearman', 'linear_reg');
            if (predictor === 'binary') { notes.push('A continuous outcome against two groups is a group comparison: the point-biserial correlation is the same test as Welch’s t.'); return pick('welch_t', 'mann_whitney'); }
            notes.push('A continuous outcome across several categories is a group comparison.');
            return pick('anova', 'kruskal', 'spearman');
        }
        if (outcome === 'binary') {
            if (predictor === 'continuous') return pick('logistic_reg', 'mann_whitney');
            if (predictor === 'binary') return pick('chisq_2x2', 'logistic_reg');
            return pick('chisq_rxc', 'logistic_reg');
        }
        if (outcome === 'categorical') return predictor === 'continuous' ? pick('multinomial_reg') : pick('chisq_rxc', 'multinomial_reg');
        if (outcome === 'ordinal') {
            if (predictor === 'continuous') return pick('spearman', 'ordinal_reg');
            if (predictor === 'binary') return pick('mann_whitney', 'ordinal_reg');
            return pick('kruskal', 'ordinal_reg');
        }
        if (outcome === 'count') return predictor === 'continuous' ? pick('poisson_reg', 'spearman') : pick('count_two', 'poisson_reg');
        if (outcome === 'time') return predictor === 'continuous' ? pick('cox') : pick('logrank', 'cox');
    }

    if (goal === 'model') {
        const clustered = a.design === 'paired';
        if (outcome === 'continuous') return clustered ? pick('lmm', 'linear_reg') : pick('linear_reg', 'lmm');
        if (outcome === 'binary') return clustered ? pick('glmm_binary', 'logistic_reg') : pick('logistic_reg', 'glmm_binary');
        if (outcome === 'categorical') { if (clustered) notes.push('Clustered multinomial outcomes are awkward: consider GEE with a multinomial link (geepack), or mixed models in brms.'); return pick('multinomial_reg'); }
        if (outcome === 'ordinal') { if (clustered) notes.push('For repeated ordinal outcomes use ordinal::clmm (random effects) or GEE.'); return pick('ordinal_reg'); }
        if (outcome === 'count') { if (clustered) notes.push('Clustered counts: lme4::glmer.nb or glmmTMB with a random intercept; GEE with a Poisson family for population-averaged rates.'); return pick('poisson_reg'); }
        if (outcome === 'time') { if (clustered) notes.push('Clustered survival: coxph with cluster(id) for robust SEs, or a frailty term for a random effect.'); return pick('cox', 'logrank'); }
    }
    return null;
}
