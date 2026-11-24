-- A new venue: Basil's Billiards Pool Lounge, Sandton (UV, 24 Nov).
--
-- From the Google Maps listing UV sent: 127 Wroxham Rd, inside The Boma Café
-- Sandton; phone 084 574 8577. Google gives the area as "Rietfontein 2-IR",
-- the land register's name; the suburb people know Wroxham Rd by is Paulshof.
--
-- Not on the listing, so left blank for its owner or the site owner to fill in
-- on the venue's Settings tab: the number of tables and the week's hours (the
-- screenshot only showed "closes 2am" for one day).
--
-- No owner or staff, as the Billiard Cafés started: nobody can tie a
-- competition to it or list it as played at until an owner is added, and only
-- the site owner can edit its details (docs/systems/foundations.md, "Venues").

insert into public.tbl_venues (name, slug, address, area, city, maps_url, phone) values
	('Basil''s Billiards Pool Lounge', 'basils-billiards', 'The Boma Café, 127 Wroxham Rd', 'Paulshof', 'Sandton',
		'https://maps.app.goo.gl/MUvaDcNCqvRJTq4j8', '084 574 8577');
