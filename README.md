# Händelser v6.7

Komplett GitHub- och Netlify-version. Alla filer ska ligga direkt i repots rot.

Versionen innehåller den privata Supabase-kopplingen, bildkomprimering före uppladdning, emojiinfogning, personlig namnhälsning och korrigerad inloggning. `config.js` innehåller projektets publika Supabase-konfiguration. Service role-nyckeln ska endast ligga som miljövariabel i Netlify.

Har databasuppdateringen för v6.5 redan körts behövs ingen ny SQL för v6.7. Annars körs `supabase/uppdatera-handelser-v6_5.sql` en gång.
