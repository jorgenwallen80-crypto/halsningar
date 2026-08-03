# Händelser

GitHub- och Netlify-klar produktionsversion.

## Det som ska ändras före publicering

1. Kör `supabase/installera-handelser.sql` i Supabase SQL Editor.
2. Kopiera `supabase/satt-koder-lokalt.sql.example` lokalt, döp kopian till `satt-koder-lokalt.sql`, fyll i mottagar-, vän- och adminkod och kör den i Supabase SQL Editor.
3. Lägg aldrig den lokala kodfilen i GitHub. Den blockeras av `.gitignore`.
4. Fyll i projektets publika Supabase URL och anon/publishable key i `config.js`.
5. Lägg följande miljövariabler i Netlify:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HANDELSER_BUCKET=handelser-images`
6. Koppla detta repo till Netlify och publicera.

## Viktigt

`SUPABASE_SERVICE_ROLE_KEY` får aldrig läggas i GitHub eller `config.js`.

När tidslinjen senare ska tas bort helt körs `supabase/avinstallera-handelser.sql` i Supabase SQL Editor.


## v6.4
Synkroniserar vän- och admin-HTML med quizredigerarna och förhindrar att kodkontrollen fastnar.


## Uppdatering från v6.4 till v6.5
Kör `supabase/uppdatera-handelser-v6_5.sql` en gång i Supabase SQL Editor. Filen lägger till redigerbart namn och välkomsttext utan att röra befintliga händelser eller koder.

## v6.5
Lägger till personlig botanisk välkomsthälsning som redigeras i admin. Videotypen heter nu `Videoklipp / YouTube` och öppningsknappen säger `Öppna videoklippet` eller `Öppna i YouTube`.
