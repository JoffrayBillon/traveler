# 🎿 Spécification Technique : Traveler (traveler.joffraybillon.fr)

Application web interne de gestion pour un séjour au ski de **160 participants**.

---

## 1. Vue d'ensemble du projet

* **Accès restreint / Zéro inscription publique :** Tous les participants et leurs configurations initiales sont pré-chargés par l'administrateur via un import unique de fichier `.xlsx`.
* **Authentification Passwordless :** Connexion via Magic Link par e-mail avec session persistante sécurisée (cookie HTTP-Only).
* **Gestion des activités :**
  * Profil exclusif : **Skieur** OU **Non-Skieur (Spa)**.
  * Extension : Option **3ᵉ jour de ski** (strictement réservée aux personnes ayant le profil *Skieur*).
* **Gestion des transports :**
  * Modes disponibles : **Train**, **Avion**, ou **Sans Transport**.
  * Billets distincts pour l'**Aller** et le **Retour** (heure de RDV, n° de train/vol, place/voiture).
  * Feature Sans Transport : Option activable *"Je viens en covoiturage"* avec sous-option *"Demande de place de parking"*.
* **Gestion du Rooming :** Répartition visuelle en chambres avec algorithme strict de non-mixité (ou mixité validée par consensus de tous les membres) et export du plan final en `.xlsx`.

---

## 2. Stack Technique (100 % Free Tier)

| Composant | Technologie | Hébergement / Quota |
| :--- | :--- | :--- |
| **Frontend** | React 19 (Vite), Tailwind CSS, Lucide Icons, `@dnd-kit/core` | Vercel (Hobby) |
| **API Backend** | Hono.js (Serverless Handler) | Vercel Serverless Functions |
| **Base de données** | Turso (libSQL / SQLite Edge) + Drizzle ORM | Plan Free (5 Go de stockage) |
| **Authentification** | Better Auth (Plugin Magic Link) | Auto-hébergé sur l'API Hono |
| **Envoi d'e-mails** | Brevo API v3 (Transactions HTTP) | Plan Free (300 mails/jour) |
| **Moteur Excel** | ExcelJS | Traitement des flux en mémoire |

---

## 3. Schéma de Base de Données (`src/db/schema.ts`)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

// ==========================================
// TABLES D'AUTHENTIFICATION (BETTER AUTH)
// ==========================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).default(true).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  gender: text("gender", { enum: ["M", "F"] }).notNull(),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
})

// ==========================================
// TABLES MÉTIER SKI TRIP
// ==========================================

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // ex: "Chambre 101"
  capacity: integer("capacity").notNull(),
  allowMixed: integer("allowMixed", { mode: "boolean" }).default(false).notNull(),
})

export const userOptions = sqliteTable("user_options", {
  userId: text("userId").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  roomId: text("roomId").references(() => rooms.id, { onDelete: "set null" }),

  // Activité
  activityProfile: text("activityProfile", { enum: ["skier", "spa"] }).notNull(),
  hasSkiDay3Option: integer("hasSkiDay3Option", { mode: "boolean" }).default(false).notNull(),
  mixedRoomConsent: integer("mixedRoomConsent", { mode: "boolean" }).default(false).notNull(),

  // Mode de Transport
  transportType: text("transportType", { enum: ["train", "flight", "none"] }).notNull(),
  departureCity: text("departureCity"), // Paris, Nantes, Bordeaux, Lyon, Toulouse, Aix (NULL si "none")

  // Billet Aller
  outboundRef: text("outboundRef"), // ex: "TGV 8402"
  outboundMeetingTime: text("outboundMeetingTime"), // ex: "07:30"
  outboundDepartureTime: text("outboundDepartureTime"), // ex: "08:15"
  outboundSeatInfo: text("outboundSeatInfo"), // ex: "Voiture 4, Siège 32"

  // Billet Retour
  inboundRef: text("inboundRef"),
  inboundMeetingTime: text("inboundMeetingTime"),
  inboundDepartureTime: text("inboundDepartureTime"),
  inboundSeatInfo: text("inboundSeatInfo"),

  // Covoiturage (uniquement si transportType == "none")
  isCarpooling: integer("isCarpooling", { mode: "boolean" }).default(false).notNull(),
  needsParkingSpace: integer("needsParkingSpace", { mode: "boolean" }).default(false).notNull(),
})
```

---

## 4. Règles Métiers & Algorithmes

### A. Règle d'exclusion des options
* Si `activityProfile === 'spa'`, la valeur `hasSkiDay3Option` doit être forcée à `false`.
* Si `transportType === 'none'`, tous les champs de billets (`outbound*`, `inbound*`, `departureCity`) doivent rester à `null`. Les options `isCarpooling` et `needsParkingSpace` deviennent alors modifiables par le participant sur son dashboard.

### B. Contrôle d'affectation et de mixité des chambres
Lors d'une tentative d'assignation d'un utilisateur $U$ à une chambre $R$ :
1. **Contrôle de capacité :** $\text{Occupants actuels} < \text{capacity}$.
2. **Contrôle de genre :**
   * Si la chambre est vide $\rightarrow$ **Autorisé**.
   * Si tous les occupants actuels partagent le même genre que $U$ $\rightarrow$ **Autorisé**.
   * Si un occupant a un genre différent de $U$ :
     * Rejeter si `rooms.allowMixed === false`.
     * Si `rooms.allowMixed === true`, vérifier que **l'ensemble** des occupants existants ET le nouvel arrivant ont le champ `mixedRoomConsent === true`. Sinon, refuser l'assignation.

---

## 5. Spécification des Fichiers Excel (ExcelJS)

### Colonnes de l'import (`POST /api/admin/import-all`)
Le fichier `.xlsx` téléversé par l'administrateur contient les colonnes suivantes (1 ligne par participant) :

1. `Nom`
2. `Prenom`
3. `Email`
4. `Genre` (`M` ou `F`)
5. `ProfilActivite` (`skier` ou `spa`)
6. `OptionSkiJ3` (`Oui` ou `Non`)
7. `TypeTransport` (`train`, `flight` ou `none`)
8. `VilleDepart` (vide si `none`)
9. `Aller_Ref`
10. `Aller_HeureRDV`
11. `Aller_HeureDepart`
12. `Aller_Siege`
13. `Retour_Ref`
14. `Retour_HeureRDV`
15. `Retour_HeureDepart`
16. `Retour_Siege`
17. `ChambreInitiale` (nom de la chambre, ex: `Chambre 101`)

### Export de la Rooming List (`GET /api/admin/export-rooming`)
L'API charge le modèle `templates/rooming-template.xlsx`, itère sur toutes les chambres ordonnées par nom/numéro, et écrit :
* Numéro de chambre, Capacité, Statut (Non-mixte / Mixte validée).
* Nom, Prénom, Genre et Email des occupants.
* Renvoi direct du fichier au client avec le header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

## 6. Intégration de l'Authentification (Better Auth + Brevo)

Fichier de configuration de l'auth (`src/lib/auth.ts`) :

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { db } from "../db"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": process.env.BREVO_API_KEY!,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "Ski Trip", email: process.env.SENDER_EMAIL },
            to: [{ email }],
            subject: "Connexion à votre espace - Ski Trip",
            htmlContent: `<p>Cliquez sur ce lien pour accéder à votre espace :</p><p><a href="${url}">${url}</a></p>`,
          }),
        })

        if (!res.ok) {
          throw new Error("Échec de l'envoi de l'e-mail de connexion via Brevo")
        }
      },
    }),
  ],
})
```

---

## 7. Configuration des Variables d'Environnement (`.env`)

```env
# Database (Turso)
TURSO_DATABASE_URL="libsql://<votre-db>.turso.io"
TURSO_AUTH_TOKEN="<votre-token-turso>"

# E-mails (Brevo)
BREVO_API_KEY="xkeysib-<votre-cle-api>"
SENDER_EMAIL="orga@votre-domaine.com"

# Authentification
BETTER_AUTH_SECRET="<chaine-secrete-aleatoire-min-32-chars>"
BETTER_AUTH_URL="http://localhost:3000"
```

---

## 8. Interfaces Utilisateur à Implémenter

### Vue Participant
* **Carte Billetterie :**
  * Affichage distinct du **Trajet Aller** et du **Trajet Retour** (mise en avant de l'heure de RDV, n° de train/vol et siège assigné).
  * Si `transportType === 'none'` : masquer les blocs de billets et afficher les deux cases à cocher *"Je viens en covoiturage"* et *"Je demande une place de parking"*.
* **Badge Activité :** Profil actif (*Skieur* avec badge J3 si applicable, ou *Spa*).
* **Carte Chambre :** Affichage de la chambre assignée, liste des colocataires et bouton de consentement à la mixité.

### Vue Administrateur
* **Tableau de bord Transports :** Filtrage par ville de départ et type de transport, listing des demandes de parking pour covoiturage.
* **Plateau de Rooming :** Système de cartes par chambre avec drag-and-drop des participants (`@dnd-kit/core`). Alerte visuelle immédiate si un déplacement enfreint la règle de mixité ou dépasse la capacité.
* **Zone Import/Export :** Bouton d'upload du fichier `.xlsx` de 160 lignes et bouton d'export de la feuille de calcul de rooming finale.