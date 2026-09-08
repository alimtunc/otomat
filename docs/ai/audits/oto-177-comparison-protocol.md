# OTO-177 — Protocole de comparaison du premier passage

Proposition du **2026-09-08**, liée à
[l'audit des instructions](oto-177-instructions-audit.md). Aucun candidat de ce
protocole n'a été lancé. La préparation des fixtures et la campagne appartiennent
au lot L4 ; ce document ne vaut pas autorisation de dépenses.

## Définition et unité de mesure

Un **premier passage réussi** satisfait tous les critères figés de la tâche,
les contrôles du repo et le diff pass, sans correction humaine ni nouvelle
instruction corrective après son lancement. Les corrections autonomes fondées
sur les tests pendant ce passage sont permises et comptées. La première réponse
finale, un arrêt, un timeout ou un besoin d'intervention termine le passage.

Une reprise automatique de transport sans nouveau contenu correctif ne crée pas
un succès supplémentaire : rattacher sa durée et son coût au même essai. Une
reprise avec « corrige ceci » est un follow-up et fait échouer le premier passage.
Une clarification produit nécessaire après lancement compte comme intervention ;
la noter séparément d'une correction et revoir ensuite la préparation du corpus.
Une campagne de planification seule doit avoir sa propre définition de réussite.

OpenAI recommande des évaluations spécifiques à la tâche, des critères fixés à
l'avance et une calibration humaine des jugements. Le protocole ci-dessous est
une proposition locale, sans recours requis à une plateforme d'evals hébergée.
[Bonnes pratiques officielles, consultées le 2026-09-08](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Trois tâches représentatives à préparer

Chaque tâche possède un énoncé identique pour les deux candidats, des exemples
visibles, des critères numérotés, une fixture initiale contrôlée et un oracle
indépendant du code proposé. Préparer et faire relire les trois fixtures avant
de sélectionner le modèle. Les scénarios B/U régressent volontairement un
comportement qui fonctionne déjà ; ne pas demander sa correction sur le HEAD sain.

| Tâche | Énoncé et point de départ proposé | Critères d'acceptation fixes | Vérification ciblée |
| --- | --- | --- | --- |
| **B — bug backend de reprise** | Dans une fixture, la reprise d'une session fournisseur perdue réutilise le dossier initial et omet la raison de récupération. Restaurer le contexte de recovery sans changer la reprise native. Owners : `apps/local-daemon/src/context`, `src/supervisor` | B1 nouveau contexte daté en recovery ; B2 issue présente une seule fois, note conservée ; B3 explication de récupération présente ; B4 reprise native garde son dossier/session ; B5 branche/worktree/plan lancé conservés | `pnpm --filter @otomat/local-daemon test tests/context/resume.test.ts` ; compléter avec une assertion sur plan inchangé dans les fixtures existantes |
| **U — changement UI des erreurs de refresh** | Sur une fixture de `QueryBoundary`, un refresh échoué cache les données conservées. Afficher les données et l'avis stale avec retry. Préserver l'option explicite de blocage utilisée pour les données qui l'exigent | U1 données conservées et notice visibles ; U2 retry fonctionnel et état pending accessible ; U3 erreur bloquante si aucune donnée ; U4 `staleData=block` conservé ; U5 aucune copie d'état de query, primitive existante réutilisée | `pnpm --filter @otomat/web test tests/components/shell/query-boundary.test.tsx` ; scénarios navigateur identiques et captures 1280×800 / 390×844 dans les deux cellules |
| **C — contrat entre packages** | Étendre `/api/health` d'un champ `protocol_version`, entier positif, valeur serveur actuelle `1`. Les anciens daemons sans ce champ doivent parser en `1`. Le client existant `health()` consomme le contrat | C1 schéma unique dans `packages/domain/src/contracts/health.ts` ; C2 champ non nullable, défaut seulement si absent, rejet de `null`, `0`, chaînes ; C3 daemon renvoie `1` ; C4 client parse ancien/nouveau payload ; C5 ni nouveau package ni accès frontend à db/daemon | Tests de contrat domain, `pnpm --filter @otomat/local-daemon test tests/api/app.test.ts`, `pnpm --filter @otomat/client test`, puis `pnpm build` avant typecheck |

Pour C, créer le test de contrat dans l'arborescence `packages/domain/tests`
en respectant les subpath imports existants ; son chemin exact est figé dans
le manifeste de préparation. Le champ a un consommateur actuel, le client
`health()`. Aucune migration SQLite n'est nécessaire pour cet exercice de contrat.

Les fixtures B/U comprennent un patch initial minimal et un test qui échoue
sur le symptôme précis. Conserver séparément la solution témoin, hors du contexte
des candidats. La solution témoin passe les assertions et les gates ; elle
valide le dispositif, sans servir de diff imposé au modèle. La préparation doit
attester qu'aucun échec non intentionnel n'est présent avant le lancement.

## Isolation et préparation reproductible

Utiliser un clone indépendant par candidat/répétition, dans un environnement de
test jetable, et une base Otomat temporaire si Compete est utilisé. Ne pas
réutiliser la base, les issues, les profils ni le cycle OTO-177 de l'utilisateur.
Compete existe dans le repo mais ne rend pas, à lui seul, les outils ou les
instructions natifs identiques. Une sélection de gagnant ne doit pas publier
ou intégrer le patch dans le checkout utilisateur.

Exemple de **préparation seulement**, après validation de L4, sans lancer de modèle :

```bash
OTO177_EVAL_ROOT=$(mktemp -d /tmp/oto-177-eval.XXXXXX)
git clone --no-hardlinks --no-checkout . "$OTO177_EVAL_ROOT/base"
git -C "$OTO177_EVAL_ROOT/base" checkout --detach 9050eb5ee97f2a1839ec215bd0a6c98af3d9ac89
git -C "$OTO177_EVAL_ROOT/base" rev-parse HEAD
git -C "$OTO177_EVAL_ROOT/base" status --short
```

Dans ce clone : `pnpm install --frozen-lockfile`, puis `pnpm check` avant les
régressions intentionnelles. Si la campagne évalue la cible après L0–L3,
remplacer le SHA par le commit validé commun et l'enregistrer avant les essais.
Créer ensuite un clone par cellule depuis cette base et appliquer la même
fixture de tâche, contrôlée par SHA-256. Aucun `git reset`, `clean`, nettoyage
de données ou copie de `.env*` du checkout utilisateur n'est nécessaire.

La préparation fixe Node/pnpm, les binaires CLI et leur empreinte, le lockfile,
le matériel, les ressources CPU/mémoire et le navigateur. Les tests doivent
utiliser les DB temporaires et stubs existants. Ne pas démarrer un daemon sur
les données utilisateur ; aucun tracker, push, PR ou effet réseau applicatif.
Les credentials de génération restent dans la configuration contrôlée du runner,
hors des fixtures et des journaux partagés. Les permissions gérées restent actives.

Ne pas copier les homes personnels pour « reproduire » le test. Préparer des
comptes/containers de test avec la même liste approuvée de skills, de plugins et
d'outils, chacun avec son home propre. Fixer un accès réseau identique et
préinstaller les dépendances. Si le navigateur ou une commande nécessaire
manque pour U, résoudre cette lacune avant le lancement ou déclarer la cellule
non comparable ; une capture fournie à un seul candidat biaise l'essai.

Le manifeste autorise les mêmes capacités : lecture/recherche/édition de
fichiers, Git local en lecture, shell et scripts de vérification du repo,
navigateur de test pour U. Les appels tracker et publication sont absents des
deux cellules. Garder la sortie des commandes identique, par exemple RTK en
mode `proxy` des deux côtés. Le confinement externe du runner limite les
écritures au clone et aux données temporaires pour les deux candidats ; ne pas
assimiler un mode Claude `auto` à un sandbox Codex `workspace-write`. Conserver
en plus les restrictions natives de chaque harness et journaliser leurs refus.

## Plan expérimental et facteurs confondants

1. **Préflight sans modèle** : contrôler les liens, ressources, commandes,
   configurations résolues et tests de transport existants. Une preuve de
   composition ne prouve pas la découverte native ni le respect des règles.
2. **Pilote payé, seulement après autorisation** : trois tâches × deux candidats
   × une répétition = **6 runs**. Candidats proposés : Astra/Codex et
   `claude-opus-5`/Claude Code, sous réserve de disponibilité confirmée. Relever
   les IDs réellement observés ; ne pas substituer un modèle indisponible sans
   changer le manifeste et le budget.
3. **Confirmation distinctement autorisée** : trois répétitions par cellule,
   soit **18 runs au total** en incluant les six premiers. Alterner et tirer au
   sort l'ordre A/B par tâche ; sessions neuves, pas de mémoire des autres patches.
   Sérialiser les candidats pour les mesures de latence sur un même hôte.
4. **Comparaison des instructions** : baseline et organisation cible sur chacun
   des deux couples modèle/harness, avec les mêmes fixtures et budgets.
   Trois répétitions représentent **36 runs au total**. Ne pas appeler cette
   matrice une simple confirmation des 18 précédents ; obtenir un nouveau budget.

Le premier test compare **deux systèmes complets**. Même avec mêmes outils
fonctionnels, Claude Code et Codex ont des prompts système, discovery, cache,
compaction et transports différents. Il ne permet pas d'attribuer un écart au
modèle seul. Pour isoler l'effet modèle, une expérience API ultérieure peut
utiliser un harness commun et les mêmes outils adaptés aux deux APIs ; elle
mesure alors un autre système et nécessite son propre plan et son coût.
L'effet harness se mesure avec un modèle inchangé dans deux transports compatibles.

Le niveau d'effort est figé dans chaque cellule et nommé avec sa provenance ;
`high` chez deux fournisseurs n'est pas une quantité égale de calcul. Pour ce
pilote, proposition explicite : Astra `high` et Opus 5 `high`, à valider dans le
manifeste. Ce choix n'est pas un changement du `xhigh` de la session d'audit.
Une variante d'effort devient une nouvelle cellule, jamais un changement caché
pendant une répétition. `ultra`, délégation automatique et reviewers sont exclus
du pilote simple ; leur intérêt peut être testé séparément avec leurs coûts.

## Registre et notation avant toute réparation

Le registre doit permettre de retrouver la preuve sans exporter tous les logs.
Utiliser JSONL ou CSV, un enregistrement par run, et des références vers les
artefacts autorisés du runner. Valeur inconnue : `null`, jamais `0`.

| Champ | Règle de collecte |
| --- | --- |
| `task_id`, `trial`, `candidate`, `instruction_variant` | Identité de cellule figée avant lancement |
| `base_sha`, `fixture_sha256`, `lockfile_sha256`, `prompt_sha256` | Même base et même énoncé par paire ; diff réel final sauvegardé |
| `instructions` | Chemins, portées, hashes des règles/skills ; corps initial rendu, sources disponibles et fichiers effectivement lus distingués |
| `runtime`, `cli_version`, `provider`, `model_requested`, `model_observed` | Alias résolu seulement avec preuve ; sinon modèle observé inconnu |
| `effort_requested`, `effort_observed`, `permissions`, `tools`, `plugins` | Réglages demandés/effectifs séparés, limites/outils absents mentionnés |
| `criteria` | B1…B5/U1…U5/C1…C5 : pass/fail/unverified avec test ou constat local |
| `checks` | Commande exacte, exit code, exécuté/non exécuté, baseline/fixture/régression ; respecter la restriction ci-dessous |
| `review_findings` | Défauts indépendants confirmés, gravité et règle : comportement, duplication, SoC, ownership, abstraction sans consommateur, commentaires inutiles |
| `human_interventions`, `corrective_followups` | Comptages séparés clarification/permission/correction ; le scoring final en aveugle n'est pas une intervention dans l'exécution |
| `autonomous_repairs`, `environment_failures` | Échecs de boucle interne distincts des dépendances/réseau/quotas indisponibles |
| `duration_s` | Horloge monotone, de lancement à fin du passage ; attente provider et durée des checks séparées si disponibles |
| `input_tokens`, `cached_input_tokens`, `cache_write_tokens`, `output_tokens`, `reasoning_tokens` | Totaux sur tous les appels et sous-agents éventuels, sans double comptage selon le schéma fournisseur |
| `cost_reported_usd`, `cost_estimated_usd` | Facture/native versus estimation explicitement séparées ; tarif/date/mode de service conservés |
| `first_pass`, `stop_reason` | Verdict à la frontière définie ci-dessus, ou non mesurable faute de preuve/droit d'usage |

Faire relire les patches finaux **avant réparation**, avec identité des candidats
masquée et ordre mélangé, par le même reviewer humain. Un défaut reçoit une
preuve `fichier:symbole` et une clause précise ; ne pas compter deux fois la
même cause. Un second humain arbitre seulement les désaccords matériels.
Ne pas lancer un reviewer IA automatique dans la boucle d'implémentation.

Rapporter nombres bruts et dénominateurs : critères satisfaits/évaluables,
checks réussis/exécutables, runs réussis/lancés, interventions et défauts.
Donner aussi la fraction de cellules non évaluables. Le taux opérationnel compte
les interruptions d'environnement ; une vue conditionnelle sur environnements
valides les sépare, sans effacer les essais défavorables. Rapporter médiane et
étendue de durée/tokens, coût cumulé et coût par tâche réussie ; zéro succès
donne un ratio non défini, pas un coût nul.

Trois répétitions par tâche constituent un petit signal, pas une preuve
statistique de supériorité. Ne promouvoir une variante que si aucune exigence ou
permission ne régresse, les défauts/interventions diminuent et le compromis
temps/coût est accepté. Un plafond proposé de +20 % de médiane par tâche pour
temps et coût peut guider la décision ; il doit être fixé avant les résultats.
Un échec dû à une référence manquante ne se corrige pas par plus d'effort.

### Restriction locale sur React Doctor

Le [contrat existant](../first-pass-quality.md#conditional-additions) interdit
de réutiliser les sorties React Doctor comme données de benchmark de modèles.
**Garder `pnpm check` intact comme gate de conformité du repo.** Avant une
campagne, clarifier le droit d'utiliser ses résultats agrégés dans ce contexte.
Ne pas transmettre diagnostics, scores, sorties ni un score qui en dérive au
registre comparatif sans résolution de cette restriction.

Sans cette résolution, les contrôles locaux restent requis, mais le rapport
comparatif se limite aux assertions fonctionnelles propriétaires et à la review
humaine autorisées ; le taux global « premier passage + tous les gates » reste
**non mesurable**, explicitement incomplet. Ne pas créer un faux `pnpm check`
allégé ni supprimer un contrôle pour obtenir un chiffre comparable.

## Budget avant une campagne payante

Consultation des tarifs : **2026-09-08**. Hypothèse illustrative par run :
**200 000 tokens d'entrée cumulés hors cache et 20 000 tokens de sortie
facturables**, sur l'ensemble de la boucle, raisonnement facturable inclus.
Pas seulement le prompt initial. Aucun appel n'excède le seuil de contexte long
de son tarif dans cet exemple ; mode standard, pas de cache écrit ou lu, outils
facturés et infrastructure non inclus. Recalculer si l'une de ces conditions change.

| Candidat explicite | Tarifs entrée/sortie, $ par MTok | Estimation par run | 3 runs | 9 runs |
| --- | --- | ---: | ---: | ---: |
| `gpt-6-astra` | 10 / 50 | 3,00 $ | 9,00 $ | 27,00 $ |
| `claude-opus-5` | 5 / 25 | 1,50 $ | 4,50 $ | 13,50 $ |
| Ensemble | Somme des deux | — | **13,50 $ / 6 runs** | **40,50 $ / 18 runs** |

Sources : [tarifs Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)
et [tarifs Anthropic](https://platform.claude.com/docs/en/about-claude/pricing).
L'[annexe Claude](oto-177-claude-sources.md#exemple-chiffré-avant-toute-campagne)
documente les alternatives ; leur moindre prix n'est pas un résultat qualité.

Avec une réserve arithmétique de 25 % : **16,88 $** pour le pilote,
**50,63 $** pour 18 runs. Tester deux variantes d'instructions sur 18 runs
chacune : **81,00 $**, ou **101,25 $** avec réserve. Ces estimations ne sont
ni des plafonds techniques ni les prix d'un abonnement Codex/Claude Code.
Le coût marginal d'un abonnement reste inconnu sans ses données de consommation.

Calcul réel : somme, par requête, des catégories facturables exclusives
`tokens × tarif/1 000 000`, plus outils, service tier et infrastructure.
Soustraire du total d'entrée les tokens cache seulement si le fournisseur les
inclut déjà dans ce total. Ne pas ajouter deux fois les tokens de raisonnement
déjà compris dans la sortie. Les champs manquants restent inconnus ; aucun prix
n'est inventé à partir de `cost_usd: null` dans le mapper Codex.

Avant autorisation, fixer IDs exacts, nombre de runs, effort, durée maximale et
plafonds de dépenses observables par le runner. Proposition de pilote : 30 min
par run, plafond opérationnel global de 20 $ avec arrêt des nouveaux lancements
à 16 $, et suivi avant chaque appel si l'API le permet. Une requête en vol peut
dépasser une estimation ; sans compteur/plafond contrôlable, ne pas présenter
20 $ comme garanti. Après six runs, arrêter pour bilan. Confirmation et variantes
demandent chacune un budget distinct. Aucun retry illimité de quota/transport.

## Résultats de cet audit

| Contrôle | Résultat / portée |
| --- | --- |
| Worktree de départ | Propre, HEAD `9050eb5ee97f2a1839ec215bd0a6c98af3d9ac89` |
| Lecture repo/hôte | 7 skills projet ; 6 liens Claude valides ; catalogue Codex et aide Claude lus sans inférence |
| Profils et configuration du run | Lecture SQLite seule ; modèle demandé Astra/xhigh attesté, modèle observé non rapporté |
| Essais comparatifs | Aucun ; critères/checks/défauts/interventions/durée/tokens/coût des candidats : non mesurés |
| `pnpm check`, première tentative | Échec avant lint/build/tests : `sh: 1: oxfmt: not found`, `node_modules missing` |
| `pnpm install --frozen-lockfile` | Échec : `[ERR_SQLITE_ERROR] unable to open database file` dans `StoreIndex.openDatabase` de pnpm |
| Installation avec store/cache temporaires, commande ci-dessous | `GET https://registry.npmjs.org/… error (EAI_AGAIN)` ; arrêt borné à 55 s, exit 124 ; aucune dépendance téléchargée |
| `pnpm check`, tentative finale | Exit 1 au même `oxfmt: not found` ; lint, React gate, build, typecheck, smoke et tests non exécutés |
| `node scripts/import-boundaries.mjs` | Exit 0, `Import boundaries: no violations (1658 source files).` |
| `node scripts/guardrails.mjs` | Exit 0, `Frontend guardrails: no violations.` ; ceci ne remplace pas l'intégralité de `pnpm guardrails` |
| Validation documentaire | 29 liens locaux/ancres vérifiés ; trois fichiers relus en diff complet ; aucun diagnostic de whitespace avec `git diff --no-index --check` |

Commande de récupération finale, exécutée sous `rtk proxy` :

```bash
timeout 55s pnpm install --frozen-lockfile --store-dir /tmp/oto-177-pnpm-store --config.cacheDir=/tmp/oto-177-pnpm-cache
```

Une tentative intermédiaire ajoutant `--config.fetchRetries=0` et
`--config.fetchTimeout=10000` a produit `ERR_INVALID_ARG_TYPE`, le délai étant
interprété comme chaîne. C'était une erreur d'invocation de cet audit, pas un
défaut du repo. Ces overrides ont été retirés ; la tentative corrigée a établi
le blocage DNS ci-dessus. Le lockfile et les fichiers suivis existants restent
inchangés. Le `node_modules` incomplet créé par l'installation n'est pas une
preuve de disponibilité des outils.

Diff pass final : **New comments: 0** ; aucune duplication de code, nouvelle
responsabilité runtime, exception d'ownership ou abstraction applicative.
Les trois documents ont des rôles distincts : diagnostic/plan, protocole,
sources Anthropic. Aucune règle ni contrôle affaibli. Violation ouverte dans le
diff documentaire : aucune identifiée. **Gate global non validé**, bloqué par
l'environnement ; ne pas déclarer le ticket entièrement « Done » au sens du
protocole repo avant un `pnpm check` vert dans un environnement équipé.
