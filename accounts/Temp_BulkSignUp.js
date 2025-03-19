var names = [
    {"name": "Albert Motimele"},
    {"name": "Alvin Naidoo"},
    {"name": "Anisha Chetty"},
    {"name": "Aron Roopnarain"},
    {"name": "Brandon Reddy"},
    {"name": "Carl Sutton"},
    {"name": "Carlton Sutton"},
    {"name": "Daniel Munsamy"},
    {"name": "David Madurai"},
    {"name": "INDER DEVRAJ"},
    {"name": "Johanna Marutha"},
    {"name": "Julius Chingore"},
    {"name": "Keshalia Naidoo"},
    {"name": "Ketan Nydoo"},
    {"name": "Kirthi Mahomed"},
    {"name": "Kumen Reddy"},
    {"name": "Kyle Halters"},
    {"name": "Maqubool Mahomed"},
    {"name": "Mervyn Abrahams"},
    {"name": "Mpho Mokgejane"},
    {"name": "Naziem Fisher"},
    {"name": "Neil Naidoo"},
    {"name": "Nerick Singh"},
    {"name": "Nikki Kundalram"},
    {"name": "Nirolan Akaloo"},
    {"name": "Paul Kane"},
    {"name": "Peter Hogarth"},
    {"name": "Praveshan Moodley"},
    {"name": "Premo Rajoo"},
    {"name": "Pru Andrews"},
    {"name": "Reagan Munsamy"},
    {"name": "Siyabonga Mthalane"},
    {"name": "Sughen Pather"},
    {"name": "Trevino Govender"},
    {"name": "Tyrone Glisson"},
    {"name": "Vickesh Hurrienarain"},
    {"name": "Warren Stevens"},
    {"name": "Yuvan Naidoo"},
    {"name": "Ruene"},
    {"name": "Jo King"},
    {"name": "Laura Lee"},
    {"name": "Llewellyn"},
    {"name": "Iqram"},
    {"name": "Tash Khan"},
    {"name": "Nadeem Khan"},
    {"name": "Kavi Sibran"},
    {"name": "Enver Joel"},
    {"name": "Micheal Pillay"},
    {"name": "Prevern Gopaul"},
    {"name": "Serge Pather"},
    {"name": "Skates"},
    {"name": "Sonja Pretorius"},
    {"name": "Nidosh Singh"},
    {"name": "Shaheen Abrahams"},
    {"name": "Rick Schoenlank"},
    {"name": "Vishen"}
  ];

document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        UploadNames();
    }
});

  async function UploadNames ()
  {
    var allEntries = [];
    for (var i = 0; i < names.length; i++)
    {
        var entry = 
        {
            name: names[i].name,
            tournamentID : "e386dcd4-ee10-42a9-b51b-8347df52587c",
            host: "BC League Players",
            entryType: 'host'
        };
        allEntries.push(entry);
    }
    var response = await supabase.from('tbl_entries').insert(allEntries).select();
    console.log("UploadNames:", response);
  }