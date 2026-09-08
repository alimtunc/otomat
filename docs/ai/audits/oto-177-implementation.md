# OTO-177 — Mise en œuvre autorisée

État du **2026-09-08**, après « ok fix tout ça ». L'audit et ses sources restent
des constats historiques au SHA `9050eb5ee97f2a1839ec215bd0a6c98af3d9ac89`.
Ce document distingue le diff réalisé des éléments préparés dont l'installation
est bloquée par les droits de cette session. Aucun tracker, commit, push, PR ou
essai de modèle payant n'a été lancé.

## Couverture des constats

| Constats / lot | Changement concret | État |
| --- | --- | --- |
| F1, L0 — profil Codex auto dangereux et dupliqué | Payload avant/après : `workspace-write`, guidance dédupliquée, sandbox distinct de l'autorisation de tâche | Préparé dans `host-profiles.json`, non appliqué à l'hôte |
| F2, L1 — tracker et contexte Otomat | `AGENTS.md → Protocol` donne priorité à la restriction du contexte attaché et distingue le workflow standalone autorisé | Appliqué |
| F3, L2 — découverte biaisée | Racines utilisateur `.agents`, `.claude`, `.codex` ; déduplication par realpath et portée projet conservées ; tests de collision, liens et scan borné | Appliqué ; origine checkout/worktree explicitée dans le guide d'exploitation |
| F4, L3 — injection sans origine | Prompt avec fichier canonique, répertoire des références et hash ; guidance identifiée comme tâche ; limites du frontmatter et annexes vivantes explicites | Appliqué ; tests de composition et lancement/reprise sans lecture du fichier source |
| F5, L0/L1 — skill qualité absent des profils | Pointeur obligatoire d'implémentation dans le guide commun ; deux profils de projet de même intention sélectionnant le skill existant | Guide appliqué ; profils préparés, non créés |
| F6, L2 — collision `prototype` | Renommage en `prototype-ui-variants`, ressource PICKER et lien Claude conservés, instructions de dépendances corrigées | Patch préparé ; chemin exact de l'ancien skill indiqué dans le guide en attendant |
| F7, L2 — atlas absent côté Claude | Lien relatif `.claude/skills/update-atlas` vers le corps existant et exception Git pour le versionner | Appliqué |
| F8, L1/L2 — gates répétés | Contrat commun : ciblé pendant l'édition, complet sur le diff final, pas de second React gate déjà inclus | Guide appliqué ; précision des corps protégés first-pass/Turkit préparée |
| F9, L1 — handoff/publication | Reste, diff non commité, checks exacts et diff pass exigés dans le guide ; footers et transitions tracker explicites dans Turkit | Guide appliqué ; patch de distribution Turkit préparé |
| F10, L2 — contradictions vendor | Politique de motion commune avec exceptions vérifiables, advisor sans dispatch d'implémentation, repli séquentiel, suppression du renvoi absent, provenance des adaptations | Patch préparé ; aucune animation applicative modifiée |
| F11, L0/L1/L3 — duplication et obsolescence | Ownership dédupliqué, identité Git commune, version React Doctor courante, messages Claude corrigés pour le canal d'approbation | Repo appliqué ; correction RTK hôte et guidance Reviewer préparées |
| F12, L4 — mesure comparative | Protocole conservé avec inconnues explicites, pas d'inférence modèle/coût dans la télémétrie ; exigences d'origine et de ressources mieux documentées | Pas de campagne ni de gain mesuré ; fixtures et pilote restent à valider sur un environnement dont les gates passent |

La découverte ne parcourt volontairement pas les worktrees de runs : cela
changerait le catalogue, la portée des profils et les instructions figées. Le
[guide d'exploitation](../agent-workflow.md) précise comment tester une version
de skill dans un projet isolé ou par invocation native de son chemin exact.
La provenance corrige l'ambiguïté ; elle ne prétend pas figer les ressources annexes.

## Exigences conservées et propriétaires

| Exigence antérieure | Propriétaire après ce diff |
| --- | --- |
| Frontières domain/db/frontend/daemon, package justifié | `AGENTS.md → Monorepo layout / Import boundaries`, gates existants |
| Commentaires, DRY au troisième usage, SoC, abstractions justifiées | `AGENTS.md → Code quality / Final diff pass` |
| React idiomatique, caches, stale data, TanStack Form | `AGENTS.md → Code quality`, aucune clause retirée |
| Ownership, limites 250 lignes, baselines qui ne croissent pas | `AGENTS.md → File ownership`, mêmes scripts/baselines |
| Writer unique, plan figé/append-only, workspace canonique, prompts déclaratifs, queries pures, séquences composées, snapshot Git, seams API | `AGENTS.md → Conventions`, invariants inchangés |
| Stack, commandes reproductibles, imports publics, source/dist et migrations | `AGENTS.md → Commands / Toolchain / Verify as you go / Source and test layout` |
| Autorité, tracker, vérification et handoff | `AGENTS.md → Protocol`, précisées pour les deux harness |
| Commit conventionnel, références issue, publication explicite | `AGENTS.md → Conventions / Protocol`, identité Git désormais commune |
| Découverte native/catalogue, modèle/effort et maintenance hôte | `docs/ai/agent-workflow.md`, chargé uniquement pour ces opérations |

Ni `.turkit.yaml`, ni les scripts de gate, ni les baselines, ni les options
de sécurité des adaptateurs n'ont été affaiblis. Le gate complet reste obligatoire.

## Installation des éléments protégés

La politique de cette session autorise les écritures dans le worktree et `/tmp`,
mais protège `.agents`, `.codex`, `.git` et les fichiers de l'hôte. L'escalade
d'approbation est indisponible. Les patchs ci-dessous sont des livrables à
installer depuis un environnement disposant de ces droits, pas une demande de
réautoriser le périmètre déjà accepté.

1. **Skills du repo** : [repository-skills.patch](oto-177-rollout/repository-skills.patch).
   À la racine de ce worktree, vérifier puis appliquer avec
   `rtk proxy git apply --check docs/ai/audits/oto-177-rollout/repository-skills.patch`,
   puis la même commande sans `--check`. Le patch inclut le renommage, la mise à
   jour du lien Claude et le pointeur du guide d'exploitation. Il conserve le pin
   upstream et la licence, et documente les adaptations locales. Re-vendoriser
   implique de réappliquer ces adaptations.
2. **Distribution Turkit** : [turkit-workflows.patch](oto-177-rollout/turkit-workflows.patch).
   Ses chemins sont relatifs à la racine des skills Turkit. Appliquer d'abord à
   leur source/distribution et republier par son mécanisme normal. Les fichiers
   installés audités sont sous `~/.agents/skills`; ne pas créer une copie métier
   divergente dans le repo. Le patch couvre `ticket`, son format de handoff,
   `handoff` et `ship`. Vérifier avec `git apply --check <chemin-absolu-du-patch>`
   depuis la racine cible avant toute installation.
3. **Adaptateur RTK de l'hôte** : [claude-rtk.patch](oto-177-rollout/claude-rtk.patch),
   relatif au home. Il remplace la promesse d'un hook automatique par un usage
   explicite et une vérification du hook effectif. Il n'installe aucun hook et
   ne change aucune permission.
4. **Profils** : [host-profiles.json](oto-177-rollout/host-profiles.json) contient
   les requêtes et corps exacts pour les profils observés sur `vps-543f6276`.
   Relire les profils via Settings/API et comparer `expected_before`; si cet
   état a changé, réconcilier le payload avant de l'envoyer. Vérifier les ids du
   projet et du skill ainsi que les modèles/options annoncés sur cet hôte.
   Appliquer uniquement les `body` aux méthodes/chemins indiqués, par l'API du
   daemon. Ne jamais importer ces ids dans une autre base ni écrire SQLite.
   La guidance Reviewer renvoie au contrat du repo ; les deux créations de
   profils partagent la même guidance et le même skill, avec adaptations natives.
   Les efforts proposés sont des points de départ à calibrer, pas une équivalence
   de calcul ou une configuration expérimentale validée.

Après installation : rescan explicite du catalogue, vérifier un seul id par
realpath, les sept liens Claude et la sélection du skill par les profils de projet.
Résoudre les configurations sans lancer de modèle et vérifier `workspace-write`
pour Codex. Conserver intacts les profils non visés et les plans/sessions lancés.
Le renommage modifie le chemin canonique du prototype : re-sélectionner ce skill
dans les profils qui utilisaient l'ancien id, sans réécrire les configurations
historiques. Rejouer les contrôles ci-dessous sur le diff installé.

## Vérification de cette implémentation

Les dépendances ont été copiées dans ce worktree depuis un checkout ayant le
même SHA-256 de lockfile et les neuf mêmes manifests. Aucune dépendance n'est
liée vers un autre checkout. Les binaires vérifiés sont `oxfmt 0.66.0`,
`oxlint 1.81.0`, `react-doctor 0.9.13` et le `tsgo` épinglé. L'installation réseau
échoue sur DNS et le cache hors ligne manque une archive ; pnpm signale encore
des métadonnées `patchedDependencies` non synchronisées. Cette restauration ne
remplace pas une installation propre avec le lockfile avant intégration.

| Contrôle exécuté | Résultat |
| --- | --- |
| `rtk proxy pnpm build` | Vert, y compris les frontières sur 1 658 fichiers source |
| `rtk proxy pnpm typecheck` | Vert sur les neuf workspaces |
| `rtk proxy pnpm check` | Rouge : formatage, lint et gate React passent ; les tests `scripts/guardrails.test.mjs` et `scripts/react-doctor.test.mjs` échouent, arrêt avant les étapes suivantes |
| `rtk proxy node scripts/guardrails.mjs` | Vert, aucune violation |
| Sélection Vitest ci-dessous | 40 tests réussis, 38 échoués sur 78 ; les six fichiers agents/worker passent, dont les nouveaux cas ; les tests de providers et freeze échouent avec les sous-processus refusés |
| `rtk proxy pnpm smoke:dist` | Rouge : `smoke FAILED: health check timed out after 10000ms`, sortie daemon vide |
| Trois `git apply --check` | Verts contre les fichiers actuels du repo, de Turkit et du home |
| Application du patch repo dans une copie `/tmp` | Réussie, renommage/PICKER présents et sept liens Claude valides |
| Liens Markdown locaux et payloads de profils | 61 chemins présents ; quatre corps de requête conformes au schéma domain, aucune requête envoyée |

Commande ciblée exacte :

```bash
rtk proxy pnpm --filter @otomat/local-daemon test tests/agents tests/runtime/provider-options.test.ts tests/supervisor/worker.test.ts tests/supervisor/freeze-snapshot.test.ts tests/runtime/claude-interactions.test.ts tests/runtime/steering-parity.test.ts
```

Diagnostic indépendant du code modifié : Node `spawnSync("git", ["--version"])`
retourne une erreur `spawnSync git EPERM`, même avec une sortie/version et un
status `0`. Les probes des tests refusent correctement cette erreur. Un serveur
Node minimal sur un port éphémère échoue avec
`listen EPERM: operation not permitted 127.0.0.1`. Ces limitations expliquent
les obstacles aux probes et au smoke ; elles ne constituent pas une preuve que
toute la suite passerait ailleurs. Les tests inchangés de guardrails exécutés
directement donnent 4 réussites et 11 échecs sur 15. Aucun skip, changement de
probe, contournement du sandbox ou assouplissement de gate n'a été ajouté.

Le diff pass a relu les changements source, tests, règles, documents et patchs :
**New comments: 0**. Les modules conservent leur responsabilité, aucune abstraction
ni export sans consommateur, aucune duplication de code ajoutée, aucune entrée
de baseline nouvelle. Les patchs préparés sont explicitement distingués des
instructions actives. Le HTML atlas continue de décrire sa base commitée : ces
changements non commités ne lui sont pas attribués.

Restent à terminer : installer les éléments protégés, effectuer une installation
propre des dépendances, obtenir `pnpm check` vert dans un environnement autorisant
les sous-processus et le loopback, puis préparer/valider les fixtures L4 avant
tout pilote autorisé. L'implémentation n'est donc pas déclarée « Done » au sens
du protocole du repo et aucun gain de premier passage n'est revendiqué.
