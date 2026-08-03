(function () {
  'use strict';

  const facts = [
    {id:'djur-01',category:'Djur',text:'Bläckfiskar har tre hjärtan.'},
    {id:'djur-02',category:'Djur',text:'Vombaters bajs är format som små kuber.'},
    {id:'djur-03',category:'Djur',text:'En grupp flamingor kallas på engelska för en “flamboyance”.'},
    {id:'djur-04',category:'Djur',text:'Kor har nära vänner och kan bli stressade när de skiljs åt.'},
    {id:'djur-05',category:'Djur',text:'Kråkfåglar kan känna igen enskilda människoansikten.'},
    {id:'djur-06',category:'Djur',text:'Havsuttrar kan hålla varandra i tassarna när de vilar i vattnet.'},
    {id:'djur-07',category:'Djur',text:'En snigel kan ha tusentals pyttesmå tänder på sin rasptunga.'},
    {id:'djur-08',category:'Djur',text:'Getter har rektangulära pupiller.'},
    {id:'rymd-01',category:'Rymden',text:'Ett dygn på Venus är längre än ett år på Venus.'},
    {id:'rymd-02',category:'Rymden',text:'På månen kan fotspår ligga kvar mycket länge eftersom där nästan inte finns vind eller väder.'},
    {id:'rymd-03',category:'Rymden',text:'Saturnus har lägre medeldensitet än vatten.'},
    {id:'rymd-04',category:'Rymden',text:'Ljuset från solen tar ungefär åtta minuter att nå jorden.'},
    {id:'rymd-05',category:'Rymden',text:'Mars solnedgångar kan se blå ut nära solen.'},
    {id:'rymd-06',category:'Rymden',text:'Neptunus upptäcktes först genom matematiska beräkningar innan den sågs i teleskop.'},
    {id:'kropp-01',category:'Kroppen',text:'En vuxen människa har vanligtvis 206 ben i kroppen.'},
    {id:'kropp-02',category:'Kroppen',text:'Huden är människokroppens största organ.'},
    {id:'kropp-03',category:'Kroppen',text:'Du är oftast lite längre på morgonen än på kvällen.'},
    {id:'kropp-04',category:'Kroppen',text:'Ögats hornhinna har inga blodkärl.'},
    {id:'kropp-05',category:'Kroppen',text:'Människans minsta ben finns i mellanörat och kallas stigbygeln.'},
    {id:'mat-01',category:'Mat',text:'Bananer räknas botaniskt som bär, men jordgubbar gör det inte.'},
    {id:'mat-02',category:'Mat',text:'Jordnötter är baljväxter och är närmare släkt med ärtor än med nötter.'},
    {id:'mat-03',category:'Mat',text:'Cashewnötter växer utanpå en frukt som kallas cashewäpple.'},
    {id:'mat-04',category:'Mat',text:'Morötter odlades i flera färger långt innan orange blev den vanligaste.'},
    {id:'mat-05',category:'Mat',text:'Vanilj kommer från frökapseln hos en orkidé.'},
    {id:'historia-01',category:'Historia',text:'Oxford University är äldre än det aztekiska riket.'},
    {id:'historia-02',category:'Historia',text:'Cleopatra levde närmare månlandningen 1969 än byggandet av de stora pyramiderna i Giza.'},
    {id:'historia-03',category:'Historia',text:'Den kortaste kända krigshandlingen mellan två stater varade mindre än en timme.'},
    {id:'historia-04',category:'Historia',text:'Eiffeltornet kan bli flera centimeter högre under varma sommardagar när metallen expanderar.'},
    {id:'historia-05',category:'Historia',text:'Den första kända varuautomaten beskrev en maskin som delade ut heligt vatten.'},
    {id:'vardag-01',category:'Vardagen',text:'Ett vanligt A4-papper har sidförhållandet 1 till kvadratroten ur 2.'},
    {id:'vardag-02',category:'Vardagen',text:'Det lilla hålet i locket på många kulspetspennor är en säkerhetsdetalj.'},
    {id:'vardag-03',category:'Vardagen',text:'Ordet “robot” kommer från ett tjeckiskt ord för tvångsarbete.'},
    {id:'vardag-04',category:'Vardagen',text:'En standardkortlek kan blandas på fler sätt än det finns atomer på jorden.'},
    {id:'vardag-05',category:'Vardagen',text:'Bubbelplast uppfanns ursprungligen som ett slags tapet.'},
    {id:'sprak-01',category:'Språk',text:'Punkten över bokstäverna i och j kallas på engelska för en “tittle”.'},
    {id:'sprak-02',category:'Språk',text:'Ordet “alfabet” kommer från de grekiska bokstäverna alfa och beta.'},
    {id:'sprak-03',category:'Språk',text:'Tecknet & kallas ampersand och började som en sammanskrivning av de latinska bokstäverna e och t.'},
    {id:'natur-01',category:'Naturen',text:'Bambu kan växa mycket snabbt och vissa arter kan skjuta upp flera decimeter på ett dygn.'},
    {id:'natur-02',category:'Naturen',text:'En blixt kan värma luften omkring sig till flera gånger solens yttemperatur.'},
    {id:'natur-03',category:'Naturen',text:'Antarktis är världens största öken eftersom nederbörden där är så liten.'}
  ];

  window.HandelserFacts = {
    all:facts.slice(),
    categories:['Alla','Djur','Rymden','Kroppen','Mat','Historia','Vardagen','Språk','Naturen']
  };
})();
