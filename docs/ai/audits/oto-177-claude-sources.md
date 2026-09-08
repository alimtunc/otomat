# OTO-177 — Sources Anthropic et Claude Code

Consultation : **2026-09-08**. Annexe de recherche ; les comportements ci-dessous
sont documentés par Anthropic, pas mesurés dans une nouvelle session Claude.
Les pages sont évolutives : les seuils de version cités ne prouvent pas que le
binaire installé dispose de ces comportements. Aucune session candidate Claude,
campagne comparative, modification de configuration ou consultation du tracker
n'a été effectuée pour cette recherche.

## Instructions de dépôt

Claude Code utilise `CLAUDE.md` ; Anthropic propose `@AGENTS.md` ou un symlink
pour partager les règles. Imports relatifs au fichier importeur, quatre sauts
maximum ; un import externe demande une première approbation. Un import charge
le texte, donc ne réduit pas son coût de contexte.
[Mémoire et instructions](https://code.claude.com/docs/en/memory).

| Couche | Chargement documenté |
| --- | --- |
| Organisation | `/etc/claude-code/CLAUDE.md` sous Linux ; avant utilisateur/projet |
| Utilisateur | `~/.claude/CLAUDE.md`, puis instructions projet |
| Projet | Ancêtres jusqu'au répertoire courant, racine vers répertoire courant ; `CLAUDE.local.md` après `CLAUDE.md` à chaque niveau |
| Sous-répertoires | À la lecture de fichiers concernés |
| `.claude/rules/**/*.md` | Sans `paths` : au démarrage ; avec `paths` : à la lecture d'un fichier correspondant |

Les contenus se concatènent ; les contradictions restent ambiguës. Moins de
200 lignes est un conseil, pas une limite technique.
[Ordre, portée et concision](https://code.claude.com/docs/en/memory).

## Skills, commandes et collisions

Les skills projet vivent dans `.claude/skills/<nom>/SKILL.md`, les personnels dans
`~/.claude/skills/`. Les descriptions sont découvertes avant le corps, chargé à
l'invocation. Les liens symboliques de dossiers sont acceptés ; plusieurs liens
vers la même cible ne chargent le skill qu'une fois. Les sous-répertoires sont
découverts à la demande. À nom égal, priorité entreprise > personnel > projet ;
un skill gagne sur une ancienne commande `.claude/commands/*.md`. Les plugins
gardent leur espace de noms. Les commandes restent supportées, mais Anthropic
préfère les skills pour les nouveaux workflows.
[Skills et résolution des noms](https://code.claude.com/docs/en/skills).

`disable-model-invocation: true` réserve l'invocation à l'utilisateur ;
`user-invocable: false` fait l'inverse. `allowed-tools` peut accorder des outils
sans approbation individuelle pendant l'invocation. Ces champs sont des fonctions
du harness : leur copie comme texte dans un profil ne démontre pas leur exécution.
[Frontmatter et invocation](https://code.claude.com/docs/en/skills).

**Conséquence proposée** : conserver un corps partagé et tester séparément la
découverte native, l'injection par Otomat et les effets du frontmatter. Contrôler
les collisions avant de conclure qu'un skill projet est effectivement utilisé.

## Configuration, permissions et outils

L'ordre général des réglages est : géré > arguments CLI > projet local > projet
partagé > utilisateur. Les listes fusionnent souvent ; les variables d'environnement
ont des règles par clé, pas une priorité uniforme. `/status` montre les fichiers
chargés ; `claude doctor` aide à détecter les valeurs rejetées. Une exécution `-p`
peut ignorer un fichier ou une valeur invalide et continuer, hors cas gérés bloquants.
[Réglages et priorité](https://code.claude.com/docs/en/settings).

Les permissions sont appliquées par Claude Code, indépendamment des intentions
du modèle. Ordre : `deny`, puis `ask`, puis `allow`, même entre portées différentes.
`plan` permet l'exploration sans modifier les sources ; `dontAsk` refuse ce qui
n'est pas préautorisé et refuse notamment `AskUserQuestion`. Aucune prose dans
`CLAUDE.md` ne remplace ces contrôles.
[Permissions](https://code.claude.com/docs/en/permissions).

`AskUserQuestion`, `Bash`, `Read`, `Edit` et `Agent` sont des outils nommés du
harness Claude Code. Les permissions utilisent leurs noms canoniques. Le délai
optionnel d'une question ne résout jamais automatiquement une approbation de
permission ou de plan. Les variables exportées dans une commande Bash ne
persistent pas nécessairement dans la suivante.
[Référence des outils](https://code.claude.com/docs/en/tools-reference).

**Conséquence proposée** : un workflow commun décrit l'intention (« demander la
préférence nécessaire ») ; l'adaptateur utilise l'outil réellement disponible et
le mode courant. Une panne d'approbation ou de réseau est une différence
d'environnement à enregistrer, pas une raison d'élargir les permissions.

## Contexte et vérification

Après compaction, les instructions racine et règles inconditionnelles sont
réinjectées. Les règles à chemins et `CLAUDE.md` imbriqués rechargent à la lecture
des fichiers concernés. Les corps de skills invoqués sont réinjectés dans une
limite documentée de 5 000 tokens par skill et 25 000 au total ; les plus anciens
sont retirés en premier. Une procédure longue ne bénéficie donc pas d'une
persistance illimitée.
[Contexte et compaction](https://code.claude.com/docs/en/context-window).

Anthropic recommande des critères vérifiables, des commandes de test/build et
des captures pour le visuel ; le résultat doit montrer une preuve plutôt qu'une
simple affirmation. La planification est utile quand l'approche est incertaine,
mais ajoute un coût pour une correction petite et évidente. Des chemins précis,
des symptômes et des exemples existants orientent l'exploration. Il s'agit de
recommandations de l'éditeur, pas d'un gain quantifié sur Otomat.
[Bonnes pratiques](https://code.claude.com/docs/en/best-practices).

**Hypothèse à évaluer** : conserver les invariants courts au chargement initial,
résoudre les références utiles par tâche, puis vérifier avec les commandes du
repo devrait réduire les omissions évitables. Cette recherche ne mesure ni la
taille optimale ni l'amélioration obtenue. Un fichier plus court qui perd une
contrainte métier est une régression.

## Modèle, version et effort

La documentation actuelle liste notamment `claude-opus-5`, `claude-sonnet-5`,
`claude-fable-5-1` et `claude-haiku-4-5-20251001`. Les trois premiers annoncent
1M de contexte et 128K de sortie maximum ; Haiku 4.5, 200K et 64K. Le catalogue
public ne démontre ni l'accès du compte ni le modèle exécuté par Otomat.
[Catalogue des modèles](https://platform.claude.com/docs/en/models/overview).

Depuis la génération 4.6, un ID comme `claude-opus-4-6` désigne un snapshot fixe
malgré l'absence de date. Les aliases CLI `opus` ou `sonnet` restent distincts
de ces IDs. Les poids fixes n'empêchent pas l'évolution de l'infrastructure
d'inférence autour du modèle.
[IDs et versions](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions).

Les aliases CLI dépendent du fournisseur et évoluent. Sur l'API Anthropic, la
documentation fait actuellement résoudre `opus` vers Opus 5 et `sonnet` vers
Sonnet 5 ; les autres plateformes ont des correspondances différentes. Opus 5
requiert Claude Code 2.1.219, Sonnet 5 2.1.197. L'effort est propre au modèle :
`xhigh` devient `high` sur Opus 4.6. `ultrathink` ajoute une instruction sans
modifier l'effort API ; `ultracode` active une orchestration du harness, au-delà
de l'effort `xhigh`. Ces deux mécanismes ne sont pas des synonymes portables
d'effort maximal.
[Configuration du modèle et de l'effort](https://code.claude.com/docs/en/model-config).

L'inventaire local de cet audit relève Claude Code **2.1.263** et
`~/.claude/settings.json` contenant `model: fable[1m]`, `effortLevel: xhigh`.
Ce sont des valeurs configurées, pas une trace d'inférence. La documentation
reconnaît `fable[1m]` et indique que `fable` vise Fable 5.1 depuis 2.1.255,
sauf surcharge. Fable accepte `xhigh`. Ces éléments rendent la configuration
plausible ; seul l'ID observé et l'effort effectif d'une session existante
permettent de conclure sur son exécution.
[Alias Fable et effort](https://code.claude.com/docs/en/model-config).

Dans l'API, `output_config.effort` oriente la consommation ; ce n'est pas un
budget strict. Il affecte raisonnement, texte et appels d'outils. Anthropic
recommande des points de départ différents : `medium` pour beaucoup d'usages
Sonnet 4.6, `xhigh` pour le code avec Opus 4.7/4.8, `high` pour Opus 5, puis des
ajustements fondés sur les évaluations. `max` n'est pas un défaut universel et
peut surconsommer avec peu de gain. Un réglage API n'est pas automatiquement
celui appliqué par une version donnée de Claude Code.
[Effort API](https://platform.claude.com/docs/en/build-with-claude/effort).

**Conséquence proposée** : enregistrer ID demandé, ID observé, fournisseur,
version du CLI, effort demandé/effectif et éventuel changement de modèle. Ne pas
assimiler `high` entre modèles ou fournisseurs. Astra n'est identifié ni tarifé
par ces sources Anthropic ; aucune correspondance n'est déduite ici.

## Exemple chiffré avant toute campagne

Prix API standard en USD par million de tokens, consultés le 2026-09-08 :

| Modèle explicite | Entrée hors cache | Sortie |
| --- | ---: | ---: |
| Claude Opus 4.6, 4.7, 4.8 ou 5 | 5 $ | 25 $ |
| Claude Sonnet 4.6 | 3 $ | 15 $ |
| Claude Sonnet 5 | 2 $ | 10 $ |

La page précise que la hausse annoncée pour Sonnet 5 au 1er septembre a été
annulée. Écriture/lecture de cache, Batch, outils et options peuvent modifier
la facture. Ce ne sont pas des tarifs d'abonnement Claude Code ni d'Astra.
[Tarification Anthropic](https://platform.claude.com/docs/en/about-claude/pricing).

**Hypothèses illustratives, sans exécution** : 3 tâches × 3 répétitions = 9 runs
par candidat ; chaque run cumule 200 000 tokens d'entrée hors cache et 20 000
tokens de sortie sur toute la boucle. Ce cumul inclut les requêtes répétées,
pas seulement le prompt initial.

- Opus : `0,2 × 5 + 0,02 × 25 = 1,50 $/run`, donc **13,50 $** pour 9 runs.
- Sonnet 4.6 : `0,2 × 3 + 0,02 × 15 = 0,90 $/run`, donc **8,10 $**.
- Sonnet 5 : `0,2 × 2 + 0,02 × 10 = 0,60 $/run`, donc **5,40 $**.

Pour un candidat OpenAI, remplacer ses prix vérifiés dans
`9 × (0,2 × prix_entrée_MTok + 0,02 × prix_sortie_MTok)` et ajouter les deux
colonnes. Réserver, par exemple, 25 % d'aléa est une décision de budget proposée,
pas une garantie de plafond. Pour Opus seul : **16,88 $** avec cette réserve.
Fixer un plafond de campagne surveillé et des conditions d'arrêt avant
autorisation ; les volumes ci-dessus ne constituent pas une limite technique.

## Limites à conserver dans l'audit

- Aucune qualité comparative, durée, consommation réelle ou réussite au premier
  passage n'a été mesurée ici. Le budget est une simulation arithmétique.
- La présence d'un fichier, son chargement natif, son injection par un profil et
  son respect par le modèle sont quatre preuves différentes.
- Les docs publiques décrivent Claude Code actuel. Pour le binaire du VPS,
  confronter les constats aux traces et à la version locale sans lancer une
  nouvelle génération facturée pour cet audit.
- Le protocole local existant interdit de réutiliser les sorties React Doctor
  pour un benchmark de modèles. Conserver `pnpm check` comme gate du repo ;
  traiter cette restriction avant de collecter ses résultats pour une campagne.
  [Règle locale et limites du pilote](../first-pass-quality.md).
