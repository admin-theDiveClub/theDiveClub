//Maya ASCII 2023 scene
//Name: C5_1_Planning.ma
//Last modified: Tue, Sep 29, 2026 09:03:55 AM
//Codeset: 1252
requires maya "2023";
requires -nodeType "aiOptions" -nodeType "aiAOVDriver" -nodeType "aiAOVFilter" -nodeType "aiSkyDomeLight"
		 "mtoa" "5.2.0";
currentUnit -l centimeter -a degree -t film;
fileInfo "application" "maya";
fileInfo "product" "Maya 2023";
fileInfo "version" "2023";
fileInfo "cutIdentifier" "202208031415-1dee56799d";
fileInfo "osv" "Windows 11 Pro v2009 (Build: 26200)";
fileInfo "UUID" "A073629A-40E4-DF40-357F-50A814E31421";
createNode transform -s -n "persp";
	rename -uid "7A1356C0-41A0-6E9D-7FC2-0A9165626649";
	setAttr ".v" no;
	setAttr ".t" -type "double3" 984.48105014995622 48.327490881664573 107.65397619502244 ;
	setAttr ".r" -type "double3" -1.5383527186098458 379.39999999990022 0 ;
	setAttr ".rp" -type "double3" 3.5527136788005009e-14 -4.6185277824406512e-14 -3.5527136788005009e-14 ;
	setAttr ".rpt" -type "double3" -3.0405925522677907e-14 4.1609546290115758e-14 3.6076341829335356e-14 ;
createNode camera -s -n "perspShape" -p "persp";
	rename -uid "908F2F26-452B-8F37-B776-31849FFE7FDA";
	setAttr -k off ".v" no;
	setAttr ".fl" 23.458043086840117;
	setAttr ".coi" 156.38934796046385;
	setAttr ".imn" -type "string" "persp";
	setAttr ".den" -type "string" "persp_depth";
	setAttr ".man" -type "string" "persp_mask";
	setAttr ".tp" -type "double3" 1033.5640869140625 15.88470458984375 -504.5 ;
	setAttr ".hc" -type "string" "viewSet -p %camera";
createNode transform -s -n "top";
	rename -uid "C69F60B8-460D-2BF9-25E8-98AFDD41C435";
	setAttr ".v" no;
	setAttr ".t" -type "double3" 1005.3574830810674 1124.5543804650233 166.27646677048324 ;
	setAttr ".r" -type "double3" -90 0 0 ;
createNode camera -s -n "topShape" -p "top";
	rename -uid "2D445770-4DDE-9482-5162-3396ABD5B441";
	setAttr -k off ".v" no;
	setAttr ".rnd" no;
	setAttr ".coi" 1153.1210916981743;
	setAttr ".ow" 295.96015489873133;
	setAttr ".imn" -type "string" "top";
	setAttr ".den" -type "string" "top_depth";
	setAttr ".man" -type "string" "top_mask";
	setAttr ".tp" -type "double3" 839.7336457737855 -28.566711233150951 163.93069739103461 ;
	setAttr ".hc" -type "string" "viewSet -t %camera";
	setAttr ".o" yes;
	setAttr ".ai_translator" -type "string" "orthographic";
createNode transform -s -n "front";
	rename -uid "8573947D-4441-354F-FA2D-639A35BAE840";
	setAttr ".v" no;
	setAttr ".t" -type "double3" 0 0 1000.1 ;
createNode camera -s -n "frontShape" -p "front";
	rename -uid "3999166E-4509-4063-8CAA-99BCEE6DA9A1";
	setAttr -k off ".v" no;
	setAttr ".rnd" no;
	setAttr ".coi" 1000.1;
	setAttr ".ow" 30;
	setAttr ".imn" -type "string" "front";
	setAttr ".den" -type "string" "front_depth";
	setAttr ".man" -type "string" "front_mask";
	setAttr ".hc" -type "string" "viewSet -f %camera";
	setAttr ".o" yes;
	setAttr ".ai_translator" -type "string" "orthographic";
createNode transform -s -n "side";
	rename -uid "03ACEB43-4694-07DC-E4A9-A4864DC09C66";
	setAttr ".v" no;
	setAttr ".t" -type "double3" 1000.1 0 0 ;
	setAttr ".r" -type "double3" 0 90 0 ;
createNode camera -s -n "sideShape" -p "side";
	rename -uid "B1F82916-4EF2-69B7-1AB4-8F9A1CA22668";
	setAttr -k off ".v" no;
	setAttr ".rnd" no;
	setAttr ".coi" 1000.1;
	setAttr ".ow" 30;
	setAttr ".imn" -type "string" "side";
	setAttr ".den" -type "string" "side_depth";
	setAttr ".man" -type "string" "side_mask";
	setAttr ".hc" -type "string" "viewSet -s %camera";
	setAttr ".o" yes;
	setAttr ".ai_translator" -type "string" "orthographic";
createNode transform -n "aiSkyDomeLight1";
	rename -uid "315EA2DC-4817-DD94-E669-4C9F52011D10";
createNode aiSkyDomeLight -n "aiSkyDomeLightShape1" -p "aiSkyDomeLight1";
	rename -uid "838D1150-43E4-60D3-0D5B-CA9CA40FF5B1";
	addAttr -ci true -h true -sn "aal" -ln "attributeAliasList" -dt "attributeAlias";
	setAttr -k off ".v";
	setAttr ".csh" no;
	setAttr ".rcsh" no;
	setAttr ".gskrd" 2000;
	setAttr ".hwta" 0.10000000149011612;
	setAttr ".aal" -type "attributeAlias" {"exposure","aiExposure"} ;
createNode transform -n "directionalLight1";
	rename -uid "A0AAF89C-4040-E628-1B63-7E81E639226B";
	setAttr ".r" -type "double3" -13.191952399480952 -119.99999999999997 0 ;
	setAttr ".s" -type "double3" 100 100 100 ;
createNode directionalLight -n "directionalLightShape1" -p "directionalLight1";
	rename -uid "C250839F-497E-8A56-3544-C28EE93C4A04";
	setAttr -k off ".v";
createNode transform -n "group11";
	rename -uid "BB5AB4B4-4E53-FC6B-214D-F6BDDE89838D";
createNode transform -n "polySurface20" -p "group11";
	rename -uid "FBA7B957-4B39-630A-1FEE-2CBB7E8850D1";
	setAttr ".t" -type "double3" 434.9999899529659 0 0 ;
createNode mesh -n "polySurfaceShape32" -p "polySurface20";
	rename -uid "153D0CE2-41FB-420F-440D-B9BA08FDD0CB";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:21]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 3 "e[0]" "e[3]" "e[10]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 3 "e[0]" "e[3]" "e[10]";
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 47 ".uvst[0].uvsp[0:46]" -type "float2" 0 0 0.0125 0 0.018750001
		 0.5 0 0.5 0.025 1 0 1 0.090296879 0.5 0.12039585 1 0.060197927 0 0 0 1 0 1 1 0 1
		 0 0 1 0 1 1 0 1 0 0 0.0125 0 0.018750001 0.5 0 0.5 0.025 1 0 1 0.090296879 0.5 0.12039585
		 1 0.060197927 0 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 0.0125 0 0.025 1 0 1 0.090296879
		 0.5 0.12039585 1 0.060197927 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 24 ".vt[0:23]"  -208.5 0 -496 -208.5 438 -496 -198.71246338 -1.0831434e-19 -496
		 -198.49998474 438 -496 -198.60623169 200.00050354004 -496 -208.5 200.00050354004 -496
		 -158.67834473 418.62728882 -495.99996948 -158.77416992 200.00039672852 -496 -158.87002563 -2.1662866e-19 -495.99996948
		 -238.5 0 -496 -238.5 200.00050354004 -496 -238.5 438 -496 -208.5 0 -521 -198.71246338 -1.9121851e-06 -521
		 -198.60623169 200.00050354004 -521 -208.5 200.00050354004 -521 -198.49998474 438 -521
		 -208.5 438 -521 -158.67834473 418.62728882 -521 -158.77416992 200.00039672852 -521
		 -158.87002563 -1.9121851e-06 -521 -238.5 200.00050354004 -521 -238.5 0 -521 -238.5 438 -521;
	setAttr -s 44 ".ed[0:43]"  0 2 0 0 5 1 1 3 0 3 6 0 2 4 1 4 3 1 5 1 1
		 4 5 1 2 8 0 7 4 1 6 7 0 7 8 0 0 9 0 5 10 1 9 10 0 1 11 0 10 11 0 0 12 1 2 13 1 12 13 0
		 13 14 1 14 15 1 12 15 1 3 16 1 14 16 1 1 17 1 17 16 0 15 17 1 6 18 0 7 19 1 18 19 0
		 16 18 0 19 14 1 8 20 0 19 20 0 13 20 0 10 21 1 15 21 1 9 22 0 22 21 0 12 22 0 11 23 0
		 17 23 0 21 23 0;
	setAttr -s 22 -ch 88 ".fc[0:21]" -type "polyFaces" 
		f 4 22 -22 -21 -20
		mu 0 4 34 3 2 35
		f 4 27 26 -25 21
		mu 0 4 3 37 36 2
		f 4 32 24 31 30
		mu 0 4 38 2 36 39
		f 4 -36 20 -33 34
		mu 0 4 40 35 2 38
		f 4 40 39 -38 -23
		mu 0 4 43 42 41 10
		f 4 37 43 -43 -28
		mu 0 4 13 46 45 44
		f 4 0 4 7 -2
		mu 0 4 17 18 19 20
		f 4 -8 5 -3 -7
		mu 0 4 20 19 21 22
		f 4 -11 -4 -6 -10
		mu 0 4 23 24 21 19
		f 4 -12 9 -5 8
		mu 0 4 25 23 19 18
		f 4 1 13 -15 -13
		mu 0 4 26 27 28 29
		f 4 6 15 -17 -14
		mu 0 4 30 31 32 33
		f 4 17 19 -19 -1
		mu 0 4 0 34 35 1
		f 4 23 -27 -26 2
		mu 0 4 4 36 37 5
		f 4 29 -31 -29 10
		mu 0 4 6 38 39 7
		f 4 28 -32 -24 3
		mu 0 4 7 39 36 4
		f 4 33 -35 -30 11
		mu 0 4 8 40 38 6
		f 4 18 35 -34 -9
		mu 0 4 1 35 40 8
		f 4 36 -40 -39 14
		mu 0 4 11 41 42 12
		f 4 38 -41 -18 12
		mu 0 4 12 42 43 9
		f 4 25 42 -42 -16
		mu 0 4 14 44 45 15
		f 4 41 -44 -37 16
		mu 0 4 15 45 46 16;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface24" -p "group11";
	rename -uid "E125AA27-48CE-2E13-BB70-3B96620EF2E6";
	setAttr ".t" -type "double3" 434.9999899529659 0 0 ;
createNode mesh -n "polySurfaceShape54" -p "polySurface24";
	rename -uid "3B80917B-4521-968F-DF8D-6391B163C58B";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:53]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 2 "e[9]" "e[17]";
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 2 "e[9]" "e[17]";
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 95 ".uvst[0].uvsp[0:94]" -type "float2" 0.5 0 0.5 0.5 0 0.5
		 0 0 1 0.5 1.6400945e-09 1.94805193 0.75000006 0.5 0.75 0 0.75000012 1 1.000000119209
		 1.000000119209 0.50000006 1 0 1 1 1 3.280189e-09 3.89610386 0 0 0.5 0 0.5 0.5 0 0.5
		 0 0 1 0 1 0.5 1.6400945e-09 1.94805193 1 0.50000006 0.75000006 0.5 0.75 0 1 0 0.75000012
		 1 1.000000119209 1.000000119209 0.50000006 1 0 1 1 1 3.280189e-09 3.89610386 0 0
		 0.5 0 0.5 0.5 1 0 1.6400945e-09 1.94805193 0.75000006 0.5 0.75 0 1 0 1 0.50000006
		 1.000000119209 1.000000119209 0.75000012 1 0.50000006 1 0 1 1 1 3.280189e-09 3.89610386
		 0.5 0 0.5 0 0.5 1.22402596 0.5 2.44805193 0.5 2.44805193 0.5 2.44805193 0.5 1.22402596
		 0 0 1.6400945e-09 1.94805193 0.5 1.22402596 0.5 0 3.280189e-09 3.89610386 0.5 2.44805193
		 0 0 0 0 1.6400945e-09 1.94805193 3.280189e-09 3.89610386 3.280189e-09 3.89610386
		 1.6400945e-09 1.94805193 0 0 3.280189e-09 3.89610386 0.5 0 0.5 1.22402596 0.5 2.44805193
		 3.280189e-09 3.89610386 3.280189e-09 3.89610386 1.6400945e-09 1.94805193 0 0 0 0
		 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[61:64]" -type "float3"  -1.8011475 0 0 -1.8011475 
		0 0 -1.8011475 0 0 -1.8011475 0 0;
	setAttr -s 65 ".vt[0:64]"  208.5 -7.1054274e-15 -56 208.5 -1.4210855e-14 68
		 208.5 199.99949646 68 208.5 199.99949646 -56 312.5 0 -56 312.5 199.99949646 -56 208.5 199.99949646 496
		 208.5 199.99949646 228 208.5 -4.322958e-15 228 208.5 7.2996571e-15 496 208.5 240 228
		 208.5 240 496 208.5 240 68 208.5 240 -56 312.5 240 -56 216.5 -1.4210855e-14 68 216.5 -7.1054274e-15 -48
		 216.5 199.99949646 68 216.5 199.99949646 -48 216.5 199.99949646 496 216.5 199.99949646 228
		 216.5 -4.322958e-15 228 216.5 7.2996571e-15 496 216.5 240 228 216.5 240 496 216.5 240 68
		 216.5 240 -48 312.5 240 -48 304.40100098 -3.5527137e-15 -56 304.40112305 -3.5527137e-15 -48
		 304.40112305 199.99949646 -48 304.40112305 240 -48 304.40100098 240 -56 304.40100098 199.99949646 -56
		 312.5 0 50.000019073486 312.5 199.99949646 50.000019073486 304.40112305 199.99949646 50.000019073486
		 304.40112305 -3.5527137e-15 50.000019073486 312.5 240 50.000019073486 304.40112305 240 50.000019073486
		 320.5 199.99949646 -56 320.5 199.99949646 -48 320.5 0 -48 320.5 0 -56 320.5 240 -56
		 320.5 240 -48 320.5 199.99949646 50.000019073486 320.5 0 50.000019073486 320.5 240 50.000019073486
		 304.40112305 -3.5527137e-15 5.000001907349 304.40112305 199.99949646 5.000001907349
		 304.40112305 240 5.000001907349 312.5 240 5.000001907349 320.5 240 5.000001907349
		 320.5 199.99949646 5.000001907349 320.5 0 5.000001907349 304.40112305 -257 50.000019073486
		 312.5 -257 50.000019073486 320.5 -257 50.000019073486 304.40112305 -257 5.000001907349
		 320.5 -257 5.000001907349 298.30114746 -3.5527137e-15 5.000001907349 298.30114746 -3.5527137e-15 50.000019073486
		 298.30114746 -257 5.000001907349 298.30114746 -257 50.000019073486;
	setAttr -s 120 ".ed[0:119]"  1 0 0 1 2 0 2 3 1 0 3 0 0 28 0 3 33 1 4 5 1
		 6 7 1 8 7 0 9 8 0 9 6 0 7 10 1 6 11 0 11 10 0 2 12 1 7 2 0 10 12 0 12 13 0 3 13 0
		 13 32 0 5 14 1 1 15 0 15 16 0 2 17 0 15 17 0 17 18 1 16 18 0 16 29 0 18 30 1 7 20 0
		 19 20 1 8 21 0 21 20 0 22 21 0 22 19 0 10 23 1 20 23 1 11 24 0 19 24 0 24 23 0 12 25 1
		 17 25 1 20 17 0 23 25 0 13 26 1 25 26 0 18 26 0 14 27 1 26 31 0 28 4 0 31 27 0 32 14 0
		 33 5 1 29 30 0 30 31 0 31 32 1 32 33 1 33 28 1 34 35 1 30 50 0 36 35 1 29 49 0 37 36 0
		 37 34 1 27 52 1 35 38 1 31 51 0 39 38 0 36 39 0 5 40 1 40 41 1 42 41 0 4 43 0 43 42 0
		 43 40 0 14 44 0 27 45 1 44 45 0 41 45 0 40 44 0 35 46 1 41 54 0 34 47 1 47 46 0 42 55 0
		 38 48 0 45 53 0 46 48 0 49 37 0 50 36 0 51 39 0 52 38 1 53 48 0 54 46 0 55 47 1 49 50 1
		 50 51 1 51 52 1 52 53 1 53 54 1 54 55 1 37 56 1 34 57 1 56 57 0 47 58 0 57 58 0 49 59 1
		 59 56 0 55 60 0 60 58 0 49 55 0 59 60 0 49 61 0 37 62 0 61 62 0 59 63 0 61 63 0 56 64 0
		 63 64 0 62 64 0;
	setAttr -s 54 -ch 216 ".fc[0:53]" -type "polyFaces" 
		f 4 26 -26 -25 22
		mu 0 4 32 2 34 33
		f 4 53 -29 -27 27
		mu 0 4 48 49 4 35
		f 4 -35 33 32 -31
		mu 0 4 40 39 38 37
		f 4 -40 -39 30 36
		mu 0 4 42 41 40 37
		f 4 -44 -37 42 41
		mu 0 4 43 42 37 34
		f 4 46 -46 -42 25
		mu 0 4 2 44 43 34
		f 4 54 -49 -47 28
		mu 0 4 49 50 45 4
		f 4 -1 1 2 -4
		mu 0 4 14 15 16 17
		f 4 57 -5 3 5
		mu 0 4 53 47 19 20
		f 4 7 -9 -10 10
		mu 0 4 22 23 24 25
		f 4 -12 -8 12 13
		mu 0 4 26 23 22 27
		f 4 -15 -16 11 16
		mu 0 4 28 16 23 26
		f 4 -3 14 17 -19
		mu 0 4 17 16 28 29
		f 4 56 -6 18 19
		mu 0 4 51 53 20 30
		f 4 21 24 -24 -2
		mu 0 4 0 33 34 1
		f 4 70 -72 -74 74
		mu 0 4 62 36 60 61
		f 4 29 -33 -32 8
		mu 0 4 6 37 38 7
		f 4 37 39 -36 -14
		mu 0 4 9 41 42 8
		f 4 23 -43 -30 15
		mu 0 4 1 34 37 6
		f 4 35 43 -41 -17
		mu 0 4 8 42 43 10
		f 4 40 45 -45 -18
		mu 0 4 10 43 44 11
		f 4 44 48 55 -20
		mu 0 4 12 45 50 52
		f 4 77 -79 -71 79
		mu 0 4 63 64 36 62
		f 4 58 -61 -63 63
		mu 0 4 54 55 56 57
		f 4 65 -68 -69 60
		mu 0 4 55 58 59 56
		f 4 -56 50 -48 -52
		mu 0 4 52 50 46 13
		f 4 -53 -57 51 -21
		mu 0 4 21 53 51 31
		f 4 -50 -58 52 -7
		mu 0 4 18 47 53 21
		f 4 71 81 100 -85
		mu 0 4 60 36 73 74
		f 4 -54 61 95 -60
		mu 0 4 49 48 68 69
		f 4 78 86 99 -82
		mu 0 4 36 64 72 73
		f 4 -51 66 97 -65
		mu 0 4 46 50 70 71
		f 4 -55 59 96 -67
		mu 0 4 50 49 69 70
		f 4 6 69 -75 -73
		mu 0 4 3 5 62 61
		f 4 47 76 -78 -76
		mu 0 4 13 46 64 63
		f 4 20 75 -80 -70
		mu 0 4 5 13 63 62
		f 4 -59 82 83 -81
		mu 0 4 55 54 66 65
		f 4 64 98 -87 -77
		mu 0 4 46 71 72 64
		f 4 -66 80 87 -86
		mu 0 4 58 55 65 67
		f 4 -96 88 62 -90
		mu 0 4 69 68 57 56
		f 4 -97 89 68 -91
		mu 0 4 70 69 56 59
		f 4 -98 90 67 -92
		mu 0 4 71 70 59 58
		f 4 -99 91 85 -93
		mu 0 4 72 71 58 67
		f 4 -100 92 -88 -94
		mu 0 4 73 72 67 65
		f 4 -101 93 -84 -95
		mu 0 4 74 73 65 66
		f 4 -64 101 103 -103
		mu 0 4 75 76 77 78
		f 4 -83 102 105 -105
		mu 0 4 79 80 81 82
		f 4 -115 116 118 -120
		mu 0 4 91 92 93 94
		f 4 94 104 -110 -109
		mu 0 4 87 88 89 90
		f 4 -107 110 108 -112
		mu 0 4 85 84 87 90
		f 4 -89 112 114 -114
		mu 0 4 83 84 92 91
		f 4 106 115 -117 -113
		mu 0 4 84 85 93 92
		f 4 107 117 -119 -116
		mu 0 4 85 86 94 93
		f 4 -102 113 119 -118
		mu 0 4 86 83 91 94;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface31" -p "group11";
	rename -uid "C5FFCE52-4F47-4620-D60B-64A60E8AB9C5";
	setAttr ".t" -type "double3" 76.378033012612946 -65.25309043326007 -0.30678176260985879 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape31" -p "polySurface31";
	rename -uid "F7348BFC-4A73-8E71-DEEA-358DAFE2AD8C";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape65" -p "polySurface31";
	rename -uid "3FDEBEC7-4D2D-7DBC-8CF9-078E0D3FD6C9";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface28" -p "group11";
	rename -uid "2D371B34-4CA1-E311-A8E9-6F904D92FFCE";
	setAttr ".t" -type "double3" 41.865893405200154 -36.307142363558704 -0.15328792192644869 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376219184 -7.4000228376215773 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape28" -p "polySurface28";
	rename -uid "55329B60-4908-8852-2292-A4B161D608CF";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape64" -p "polySurface28";
	rename -uid "C3C34CEE-4935-9F49-928B-59A21905C1B4";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pCube1_1M_Ref1" -p "group11";
	rename -uid "1A7179E2-474D-0D0D-69D7-68A2818C9E93";
	setAttr ".t" -type "double3" -221.5 0 -112.99999674326028 ;
	setAttr ".s" -type "double3" 0.1 2 3.21 ;
	setAttr ".rp" -type "double3" -5 0 -38.00000325673971 ;
	setAttr ".sp" -type "double3" -50 0 -50.000003256738921 ;
	setAttr ".spt" -type "double3" 45 0 11.99999999999941 ;
createNode mesh -n "pCube1_1M_Ref1Shape" -p "pCube1_1M_Ref1";
	rename -uid "7C6315CF-4EEE-D648-9FA4-B9912B0896F8";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "f[2]";
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[3]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "f[5]";
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "f[4]";
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[1]";
	setAttr ".pv" -type "double2" 0.5 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 14 ".uvst[0].uvsp[0:13]" -type "float2" 0.375 0 0.625 0 0.375
		 0.25 0.625 0.25 0.375 0.5 0.625 0.5 0.375 0.75 0.625 0.75 0.375 1 0.625 1 0.875 0
		 0.875 0.25 0.125 0 0.125 0.25;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  0 50 0 0 50 0 0 0 0 0 0 0 
		0 0 0 0 0 0 0 50 0 0 50 0;
	setAttr -s 8 ".vt[0:7]"  -50 -50 50 50 -50 50 -50 50 50 50 50 50 -50 50 -50
		 50 50 -50 -50 -50 -50 50 -50 -50;
	setAttr -s 12 ".ed[0:11]"  0 1 0 2 3 0 4 5 0 6 7 0 0 2 0 1 3 0 2 4 0
		 3 5 0 4 6 0 5 7 0 6 0 0 7 1 0;
	setAttr -s 6 -ch 24 ".fc[0:5]" -type "polyFaces" 
		f 4 0 5 -2 -5
		mu 0 4 0 1 3 2
		f 4 1 7 -3 -7
		mu 0 4 2 3 5 4
		f 4 2 9 -4 -9
		mu 0 4 4 5 7 6
		f 4 3 11 -1 -11
		mu 0 4 6 7 9 8
		f 4 -12 -10 -8 -6
		mu 0 4 1 10 11 3
		f 4 10 4 6 8
		mu 0 4 12 0 2 13;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface32" -p "group11";
	rename -uid "38FCE287-433A-8644-CA21-2AB504BE49C6";
	setAttr ".t" -type "double3" 93.6200703773236 -79.714295210826648 -0.38346627323198845 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape32" -p "polySurface32";
	rename -uid "8C137362-4BEC-1099-9D37-3FA7BFCCD5A7";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface8" -p "group11";
	rename -uid "3988A0D8-40FB-E86C-7176-B8BDF12617D5";
	setAttr ".t" -type "double3" -9.7875213623046875 0 0 ;
	setAttr ".rp" -type "double3" 444.78751131527059 -1.865174681370263e-14 -4 ;
	setAttr ".sp" -type "double3" 444.78751131527059 -1.865174681370263e-14 -4 ;
createNode mesh -n "polySurfaceShape8" -p "polySurface8";
	rename -uid "172F0F26-40F7-3683-38D5-8F85ACE5CD60";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:109]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0 0.625 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 142 ".uvst[0].uvsp[0:141]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0 0 0.60541677 0.5 0.60541677
		 0.58333325 0.60541677 0 0.64458334 0.5 0.64458334 0.58333325 0.64458334 0.5 0.25
		 0.58333325 0.25 0 0.60541677 0.5 0.60541677 0.5 0.5 0 0.5 0.5 0.60541677 0.58333325
		 0.60541677 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.58333325 0.25 0.58333325 0 0 0.64458334
		 0.5 0.64458334 0.5 0.60541677 0 0.60541677 0.5 0.64458334 0.58333325 0.64458334 0.58333325
		 0.60541677 0.5 0.60541677 0.5 0.75 0.5 0.64458334 0 0.64458334 0 0.75 0.58333325
		 0.75 0.58333325 0.64458334 0.5 0.64458334 0.5 0.75 0.58333325 0.25 0.5 0.25 0.5 0.5
		 0.58333325 0.5 0 0.60541677 0.5 0.60541677 0.5 0.60541677 0 0.60541677 0.5 0.5 0.5
		 0.5 0 0.5 0 0.5 0.58333325 0.60541677 0.58333325 0.60541677 0.5 0.60541677 0.58333325
		 0.5 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.5 0.25 0.5 0 0.58333325 0.25 0.58333325
		 0.25 0.58333325 0 0.58333325 0 0 0.64458334 0.5 0.64458334 0.5 0.64458334 0 0.64458334
		 0.5 0.60541677 0 0.60541677 0.58333325 0.64458334 0.58333325 0.64458334 0.5 0.64458334
		 0.58333325 0.60541677 0.5 0.60541677 0.5 0.75 0.5 0.64458334 0.5 0.75 0 0.64458334
		 0 0.75 0 0.75 0.58333325 0.75 0.58333325 0.64458334 0.58333325 0.75 0.5 0.64458334
		 0.5 0.75 0.5 0.25 0.58333325 0.25 0.5 0.5 0.58333325 0.5 0.5 0.60541677 0 0.60541677
		 0.5 0.5 0.5 0.5 0 0.5 0 0.5 0 0.60541677 0.58333325 0.60541677 0.5 0.60541677 0.58333325
		 0.60541677 0.58333325 0.5 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.5 0.25 0.5 0 0.58333325
		 0.25 0.58333325 0.25 0.58333325 0 0.58333325 0 0.5 0.64458334 0 0.64458334 0.5 0.60541677
		 0 0.60541677 0 0.64458334 0.58333325 0.64458334 0.5 0.64458334 0.58333325 0.64458334
		 0.58333325 0.60541677 0.5 0.60541677 0.5 0.64458334 0.5 0.75 0 0.64458334 0 0.75
		 0 0.75 0.5 0.75 0.58333325 0.75 0.58333325 0.64458334 0.58333325 0.75 0.5 0.64458334
		 0.5 0.75 0.5 0.25 0.58333325 0.25 0.5 0.5 0.58333325 0.5;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 96 ".pt[0:95]" -type "float3"  9.7875214 -2.8421709e-14 
		992 9.7875214 -2.8421709e-14 660 9.7875214 -1.8651747e-14 660 9.7875214 0 992 9.7875214 
		0 660 9.7875214 0 348 9.7875214 -2.8421709e-14 348 9.7875214 -1.8651747e-14 348 9.7875214 
		-2.8421709e-14 992 9.7875214 -2.8421709e-14 660 9.7875214 -2.8421709e-14 348 9.7875214 
		0 992 9.7875214 0 660 9.7875214 0 348 9.7875214 -2.8421709e-14 660 9.7875214 -2.8421709e-14 
		348 9.7875214 -2.8421709e-14 988 9.7875214 -2.8421709e-14 664 9.7875214 -2.8421709e-14 
		664 9.7875214 -2.8421709e-14 988 9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 
		352 9.7875214 -2.8421709e-14 352 9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 
		656 9.7875214 -1.8651747e-14 656 9.7875214 -2.8421709e-14 352 9.7875214 -1.8651747e-14 
		352 9.7875214 0 988 9.7875214 0 664 9.7875214 -2.8421709e-14 664 9.7875214 -2.8421709e-14 
		988 9.7875214 0 656 9.7875214 0 352 9.7875214 -2.8421709e-14 352 9.7875214 -2.8421709e-14 
		656 9.7875214 0 664 9.7875214 0 664 9.7875214 0 988 9.7875214 0 988 9.7875214 0 352 
		9.7875214 0 352 9.7875214 0 656 9.7875214 0 656 9.7875214 -2.8421709e-14 656 9.7875214 
		-2.8421709e-14 352 9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 352 9.7875214 
		-2.8421709e-14 992 9.7875214 -2.8421709e-14 660 9.7875214 -2.8421709e-14 664 9.7875214 
		-2.8421709e-14 988 9.7875214 -2.8421709e-14 660 9.7875214 -2.8421709e-14 664 9.7875214 
		-2.8421709e-14 992 9.7875214 -2.8421709e-14 988 9.7875214 -2.8421709e-14 348 9.7875214 
		-2.8421709e-14 352 9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 348 9.7875214 
		-2.8421709e-14 352 9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 660 9.7875214 
		-1.8651747e-14 660 9.7875214 -2.8421709e-14 656 9.7875214 -1.8651747e-14 656 9.7875214 
		-2.8421709e-14 348 9.7875214 -2.8421709e-14 352 9.7875214 -1.8651747e-14 348 9.7875214 
		-1.8651747e-14 352 9.7875214 0 992 9.7875214 0 660 9.7875214 0 664 9.7875214 0 988 
		9.7875214 -2.8421709e-14 664 9.7875214 -2.8421709e-14 988 9.7875214 0 348 9.7875214 
		0 352 9.7875214 0 656 9.7875214 -2.8421709e-14 352 9.7875214 -2.8421709e-14 656 9.7875214 
		0 660 9.7875214 0 664 9.7875214 0 664 9.7875214 0 988 9.7875214 0 992 9.7875214 0 
		988 9.7875214 0 348 9.7875214 0 352 9.7875214 0 352 9.7875214 0 656 9.7875214 0 656 
		9.7875214 -2.8421709e-14 656 9.7875214 -2.8421709e-14 352 9.7875214 -2.8421709e-14 
		656 9.7875214 -2.8421709e-14 352;
	setAttr -s 96 ".vt[0:95]"  226.5 200.00050354004 -496 226.5 200.00050354004 -326
		 226.5 1.0325074e-14 -326 226.5 400 -496 226.5 400 -326 226.50001526 400 -176 226.50001526 200.00050354004 -176
		 226.50001526 1.8651747e-14 -176 226.5 228.00044250488 -496 226.5 228.0004119873 -326
		 226.5 228.0004119873 -176 226.50001526 258.00067138672 -496 226.5 258.00061035156 -326
		 226.50001526 258.00061035156 -176 226.5 168.00016784668 -326 226.50001526 168.00016784668 -176
		 226.5 226.00044250488 -494 226.5 226.0004119873 -328 226.5 202.00050354004 -328 226.5 202.00050354004 -494
		 226.5 226.0004119873 -324 226.5 226.0004119873 -178 226.50001526 202.00050354004 -178
		 226.5 202.00050354004 -324 226.5 166.00016784668 -324 226.5 1.99999988 -324 226.50001526 166.00016784668 -178
		 226.50001526 1.99999988 -178 226.50001526 256.00067138672 -494 226.5 256.00061035156 -328
		 226.5 230.0004119873 -328 226.5 230.00044250488 -494 226.5 256.00061035156 -324 226.50001526 256.00061035156 -178
		 226.5 230.0004119873 -178 226.5 230.0004119873 -324 226.5 398 -328 226.5 260.00061035156 -328
		 226.50001526 260.00067138672 -494 226.5 398 -494 226.50001526 398 -178 226.50001526 260.00061035156 -178
		 226.5 260.00061035156 -324 226.5 398 -324 226.5 170.00016784668 -324 226.50001526 170.00016784668 -178
		 226.5 198.00050354004 -324 226.50001526 198.00050354004 -178 222.5 228.00044250488 -496
		 222.5 228.0004119873 -326 222.5 226.0004119873 -328 222.5 226.00044250488 -494 222.5 200.00050354004 -326
		 222.5 202.00050354004 -328 222.5 200.00050354004 -496 222.5 202.00050354004 -494
		 222.5 228.0004119873 -176 222.5 226.0004119873 -178 222.5 226.0004119873 -324 222.50001526 200.00050354004 -176
		 222.50001526 202.00050354004 -178 222.5 202.00050354004 -324 222.5 168.00016784668 -326
		 222.5 1.0325074e-14 -326 222.5 166.00016784668 -324 222.5 2.000000238419 -324 222.50001526 168.00016784668 -176
		 222.50001526 166.00016784668 -178 222.50001526 4.1239977e-07 -176 222.50001526 1.99999988 -178
		 222.50001526 258.00067138672 -496 222.5 258.00061035156 -326 222.5 256.00061035156 -328
		 222.50001526 256.00067138672 -494 222.5 230.0004119873 -328 222.5 230.00044250488 -494
		 222.50001526 258.00061035156 -176 222.50001526 256.00061035156 -178 222.5 256.00061035156 -324
		 222.5 230.0004119873 -178 222.5 230.0004119873 -324 222.5 400 -326 222.5 260.00061035156 -328
		 222.5 398 -328 222.50001526 260.00067138672 -494 222.5 400 -496 222.5 398 -494 222.50001526 400 -176
		 222.50001526 260.00061035156 -178 222.50001526 398 -178 222.5 260.00061035156 -324
		 222.5 398 -324 222.5 170.00016784668 -324 222.50001526 170.00016784668 -178 222.5 198.00050354004 -324
		 222.50001526 198.00050354004 -178;
	setAttr -s 220 ".ed";
	setAttr ".ed[0:165]"  0 8 0 0 1 0 1 6 1 2 7 0 4 12 1 1 14 0 3 4 0 5 13 0
		 4 5 0 6 15 0 8 11 0 9 1 1 10 6 0 8 9 1 9 10 1 11 3 0 12 9 1 13 10 0 11 12 1 12 13 1
		 14 2 0 15 7 0 14 15 1 8 16 0 9 17 0 16 17 0 1 18 0 17 18 0 0 19 0 19 18 0 19 16 0
		 9 20 0 10 21 0 20 21 0 6 22 0 21 22 0 1 23 0 23 22 0 20 23 0 14 24 1 2 25 1 24 25 0
		 15 26 1 24 26 0 7 27 1 26 27 0 25 27 0 11 28 1 12 29 1 28 29 0 9 30 1 29 30 0 8 31 1
		 31 30 0 31 28 0 12 32 1 13 33 1 32 33 0 10 34 1 33 34 0 9 35 1 35 34 0 32 35 0 4 36 1
		 12 37 1 36 37 0 11 38 1 38 37 0 3 39 1 38 39 0 39 36 0 5 40 1 13 41 1 40 41 0 12 42 1
		 42 41 0 4 43 1 43 42 0 43 40 0 14 44 1 15 45 1 44 45 0 1 46 1 46 44 0 6 47 1 46 47 0
		 47 45 0 8 48 1 48 49 1 17 50 0 49 50 0 16 51 0 51 50 0 48 51 0 1 52 0 49 52 1 18 53 0
		 52 53 0 50 53 0 0 54 0 54 52 0 19 55 0 54 55 0 55 53 0 54 48 0 55 51 0 10 56 1 49 56 1
		 21 57 0 56 57 0 20 58 0 58 57 0 49 58 0 6 59 1 56 59 0 22 60 0 59 60 0 57 60 0 52 59 1
		 23 61 0 52 61 0 61 60 0 58 61 0 14 62 1 2 63 0 62 63 0 24 64 0 62 64 1 25 65 0 64 65 0
		 63 65 1 15 66 1 62 66 1 26 67 0 66 67 1 64 67 0 7 68 0 66 68 0 27 69 0 68 69 1 67 69 0
		 63 68 0 65 69 0 11 70 1 70 71 1 29 72 0 71 72 1 28 73 0 73 72 0 70 73 1 71 49 1 30 74 0
		 49 74 1 72 74 0 31 75 0 48 75 1 75 74 0 48 70 0 75 73 0 13 76 1 71 76 1 33 77 0 76 77 1
		 32 78 0 78 77 0 71 78 1;
	setAttr ".ed[166:219]" 76 56 0 34 79 0 56 79 1 77 79 0 35 80 0 49 80 1 80 79 0
		 78 80 0 4 81 1 81 71 1 37 82 0 71 82 1 36 83 0 83 82 0 81 83 1 38 84 0 70 84 1 84 82 0
		 3 85 0 70 85 0 39 86 0 85 86 1 84 86 0 85 81 0 86 83 0 5 87 0 87 76 0 41 88 0 76 88 1
		 40 89 0 89 88 0 87 89 1 42 90 0 71 90 1 90 88 0 43 91 0 81 91 1 91 90 0 81 87 0 91 89 0
		 44 92 0 62 92 1 45 93 0 92 93 0 66 93 1 52 62 0 46 94 0 52 94 1 94 92 0 47 95 0 59 95 1
		 94 95 0 59 66 0 95 93 0;
	setAttr -s 110 -ch 440 ".fc[0:109]" -type "polyFaces" 
		f 4 88 90 -93 -94
		mu 0 4 102 9 96 97
		f 4 95 97 -99 -91
		mu 0 4 9 99 98 96
		f 4 -101 102 103 -98
		mu 0 4 99 100 101 98
		f 4 104 93 -106 -103
		mu 0 4 100 102 97 101
		f 4 107 109 -112 -113
		mu 0 4 9 105 103 104
		f 4 114 116 -118 -110
		mu 0 4 105 106 107 103
		f 4 -119 120 121 -117
		mu 0 4 106 99 108 107
		f 4 -96 112 122 -121
		mu 0 4 99 9 104 108
		f 4 -126 127 129 -131
		mu 0 4 109 110 111 112
		f 4 132 134 -136 -128
		mu 0 4 110 114 113 111
		f 4 137 139 -141 -135
		mu 0 4 114 115 116 113
		f 4 -142 130 142 -140
		mu 0 4 115 109 112 116
		f 4 144 146 -149 -150
		mu 0 4 121 12 117 118
		f 4 150 152 -154 -147
		mu 0 4 12 9 119 117
		f 4 -89 155 156 -153
		mu 0 4 9 102 120 119
		f 4 157 149 -159 -156
		mu 0 4 102 121 118 120
		f 4 160 162 -165 -166
		mu 0 4 12 124 122 123
		f 4 166 168 -170 -163
		mu 0 4 124 105 125 122
		f 4 -108 171 172 -169
		mu 0 4 105 9 126 125
		f 4 -151 165 173 -172
		mu 0 4 9 12 123 126
		f 4 175 177 -180 -181
		mu 0 4 132 12 127 128
		f 4 -145 182 183 -178
		mu 0 4 12 121 129 127
		f 4 185 187 -189 -183
		mu 0 4 121 130 131 129
		f 4 189 180 -191 -188
		mu 0 4 130 132 128 131
		f 4 192 194 -197 -198
		mu 0 4 133 124 134 135
		f 4 -161 199 200 -195
		mu 0 4 124 12 136 134
		f 4 -176 202 203 -200
		mu 0 4 12 132 137 136
		f 4 204 197 -206 -203
		mu 0 4 132 133 135 137
		f 4 -133 207 209 -211
		mu 0 4 114 110 138 139
		f 4 -212 213 214 -208
		mu 0 4 110 99 140 138
		f 4 118 216 -218 -214
		mu 0 4 99 106 141 140
		f 4 218 210 -220 -217
		mu 0 4 106 114 139 141
		f 4 23 25 -25 -14
		mu 0 4 48 51 50 49
		f 4 24 27 -27 -12
		mu 0 4 49 50 53 52
		f 4 26 -30 -29 1
		mu 0 4 52 53 55 54
		f 4 28 30 -24 -1
		mu 0 4 54 55 51 48
		f 4 31 33 -33 -15
		mu 0 4 49 58 57 56
		f 4 32 35 -35 -13
		mu 0 4 56 57 60 59
		f 4 34 -38 -37 2
		mu 0 4 59 60 61 52
		f 4 36 -39 -32 11
		mu 0 4 52 61 58 49
		f 4 40 -42 -40 20
		mu 0 4 62 65 64 63
		f 4 39 43 -43 -23
		mu 0 4 63 64 67 66
		f 4 42 45 -45 -22
		mu 0 4 66 67 69 68
		f 4 44 -47 -41 3
		mu 0 4 68 69 65 62
		f 4 47 49 -49 -19
		mu 0 4 70 73 72 71
		f 4 48 51 -51 -17
		mu 0 4 71 72 74 49
		f 4 50 -54 -53 13
		mu 0 4 49 74 75 48
		f 4 52 54 -48 -11
		mu 0 4 48 75 73 70
		f 4 55 57 -57 -20
		mu 0 4 71 78 77 76
		f 4 56 59 -59 -18
		mu 0 4 76 77 79 56
		f 4 58 -62 -61 14
		mu 0 4 56 79 80 49
		f 4 60 -63 -56 16
		mu 0 4 49 80 78 71
		f 4 63 65 -65 -5
		mu 0 4 81 83 82 71
		f 4 64 -68 -67 18
		mu 0 4 71 82 84 70
		f 4 66 69 -69 -16
		mu 0 4 70 84 86 85
		f 4 68 70 -64 -7
		mu 0 4 85 86 83 81
		f 4 71 73 -73 -8
		mu 0 4 87 89 88 76
		f 4 72 -76 -75 19
		mu 0 4 76 88 90 71
		f 4 74 -78 -77 4
		mu 0 4 71 90 91 81
		f 4 76 78 -72 -9
		mu 0 4 81 91 89 87
		f 4 80 -82 -80 22
		mu 0 4 66 93 92 63
		f 4 79 -84 -83 5
		mu 0 4 63 92 94 52
		f 4 82 85 -85 -3
		mu 0 4 52 94 95 59
		f 4 84 86 -81 -10
		mu 0 4 59 95 93 66
		f 4 -26 91 92 -90
		mu 0 4 17 16 97 96
		f 4 -28 89 98 -97
		mu 0 4 18 17 96 98
		f 4 -2 99 100 -95
		mu 0 4 1 2 100 99
		f 4 29 96 -104 -102
		mu 0 4 19 18 98 101
		f 4 0 87 -105 -100
		mu 0 4 2 8 102 100
		f 4 -31 101 105 -92
		mu 0 4 16 19 101 97
		f 4 -34 110 111 -109
		mu 0 4 21 20 104 103
		f 4 12 113 -115 -107
		mu 0 4 10 5 106 105
		f 4 -36 108 117 -116
		mu 0 4 22 21 103 107
		f 4 37 115 -122 -120
		mu 0 4 23 22 107 108
		f 4 38 119 -123 -111
		mu 0 4 20 23 108 104
		f 4 -21 123 125 -125
		mu 0 4 6 14 110 109
		f 4 41 128 -130 -127
		mu 0 4 25 24 112 111
		f 4 -44 126 135 -134
		mu 0 4 26 25 111 113
		f 4 21 136 -138 -132
		mu 0 4 15 7 115 114
		f 4 -46 133 140 -139
		mu 0 4 27 26 113 116
		f 4 -4 124 141 -137
		mu 0 4 7 6 109 115
		f 4 46 138 -143 -129
		mu 0 4 24 27 116 112
		f 4 -50 147 148 -146
		mu 0 4 29 28 118 117
		f 4 -52 145 153 -152
		mu 0 4 30 29 117 119
		f 4 53 151 -157 -155
		mu 0 4 31 30 119 120
		f 4 10 143 -158 -88
		mu 0 4 8 11 121 102
		f 4 -55 154 158 -148
		mu 0 4 28 31 120 118
		f 4 -58 163 164 -162
		mu 0 4 33 32 123 122
		f 4 17 106 -167 -160
		mu 0 4 13 10 105 124
		f 4 -60 161 169 -168
		mu 0 4 34 33 122 125
		f 4 61 167 -173 -171
		mu 0 4 35 34 125 126
		f 4 62 170 -174 -164
		mu 0 4 32 35 126 123
		f 4 -66 178 179 -177
		mu 0 4 37 36 128 127
		f 4 67 176 -184 -182
		mu 0 4 38 37 127 129
		f 4 15 184 -186 -144
		mu 0 4 11 3 130 121
		f 4 -70 181 188 -187
		mu 0 4 39 38 129 131
		f 4 6 174 -190 -185
		mu 0 4 3 0 132 130
		f 4 -71 186 190 -179
		mu 0 4 36 39 131 128
		f 4 7 159 -193 -192
		mu 0 4 4 13 124 133
		f 4 -74 195 196 -194
		mu 0 4 41 40 135 134
		f 4 75 193 -201 -199
		mu 0 4 42 41 134 136
		f 4 77 198 -204 -202
		mu 0 4 43 42 136 137
		f 4 8 191 -205 -175
		mu 0 4 0 4 133 132
		f 4 -79 201 205 -196
		mu 0 4 40 43 137 135
		f 4 81 208 -210 -207
		mu 0 4 45 44 139 138
		f 4 -6 94 211 -124
		mu 0 4 14 1 99 110
		f 4 83 206 -215 -213
		mu 0 4 46 45 138 140
		f 4 -86 212 217 -216
		mu 0 4 47 46 140 141
		f 4 9 131 -219 -114
		mu 0 4 5 15 114 106
		f 4 -87 215 219 -209
		mu 0 4 44 47 141 139;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape39" -p "polySurface8";
	rename -uid "2D6B4DA0-46DD-0116-1BE3-37855C2067C1";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:2]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 3 "e[0]" "e[4]" "e[7]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.29166662693023682 0.625 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  435 -39.999496 0 435 -39.999496 
		0 435 0 0 435 0 0 435 0 0 435 0 0 435 -39.999496 0 435 0 0;
	setAttr -s 8 ".vt[0:7]"  -208.5 240 -496 -208.5 240 -326 -208.5 1.0325074e-14 -326
		 -208.5 400 -496 -208.5 400 -326 -208.49998474 400 -176 -208.49998474 240 -176 -208.49998474 1.8651747e-14 -176;
	setAttr -s 10 ".ed[0:9]"  0 3 0 0 1 0 1 6 1 2 7 0 4 1 1 1 2 0 3 4 0
		 5 6 0 4 5 0 6 7 0;
	setAttr -s 3 -ch 12 ".fc[0:2]" -type "polyFaces" 
		f 4 4 -2 0 6
		mu 0 4 0 1 2 3
		f 4 7 -3 -5 8
		mu 0 4 4 5 1 0
		f 4 -6 2 9 -4
		mu 0 4 6 1 5 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface2" -p "group11";
	rename -uid "9A1C48B0-4BE5-30D8-12E9-55953668DFFC";
	setAttr ".t" -type "double3" 434.9999899529659 0 0 ;
	setAttr ".rp" -type "double3" 264.5 0 220 ;
	setAttr ".sp" -type "double3" 264.5 0 220 ;
createNode mesh -n "polySurfaceShape3" -p "polySurface2";
	rename -uid "5656CA4F-4DD8-E30E-EE7C-FF9EB40F396E";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:5]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "e[2]";
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "e[2]";
	setAttr ".pv" -type "double2" 1.8155330017144422e-10 0.76370877027511597 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 12 ".uvst[0].uvsp[0:11]" -type "float2" 0 0 1 0 1 1 3.631066e-10
		 1.52741754 0 0 1 0 1 1 3.631066e-10 1.52741754 0 0 1 0 1 1 3.631066e-10 1.52741754;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt";
	setAttr ".pt[1]" -type "float3" 0 0 -440 ;
	setAttr ".pt[3]" -type "float3" 0 0 -440 ;
	setAttr ".pt[5]" -type "float3" 0 0 -440 ;
	setAttr ".pt[7]" -type "float3" 0 0 -440 ;
	setAttr -s 8 ".vt[0:7]"  320.5 0 496 208.5 0 -56 208.5 0 496 320.5 0 -56
		 208.5 -25 496 208.5 -25 -56 320.5 -25 496 320.5 -25 -56;
	setAttr -s 12 ".ed[0:11]"  2 0 0 0 3 0 2 1 0 1 3 0 2 4 0 1 5 0 4 5 0
		 0 6 0 4 6 0 3 7 0 6 7 0 5 7 0;
	setAttr -s 6 -ch 24 ".fc[0:5]" -type "polyFaces" 
		f 4 11 -11 -9 6
		mu 0 4 8 11 10 9
		f 4 -3 0 1 -4
		mu 0 4 4 5 6 7
		f 4 5 -7 -5 2
		mu 0 4 0 8 9 1
		f 4 4 8 -8 -1
		mu 0 4 1 9 10 2
		f 4 7 10 -10 -2
		mu 0 4 2 10 11 3
		f 4 9 -12 -6 3
		mu 0 4 3 11 8 0;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface35" -p "group11";
	rename -uid "0A58EE7A-44E5-55A8-A1D7-00A86D7BEB83";
	setAttr ".t" -type "double3" 935.63949943180182 -1027.1774026331086 68.106209924839504 ;
	setAttr ".r" -type "double3" 90 0 90 ;
	setAttr ".s" -type "double3" 1 1.657491075826123 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -3.0662759821607919 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -653.57562637329102 820.63313999583272 -167.05751362254165 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.2163257610819214 0 ;
createNode mesh -n "polySurfaceShape35" -p "polySurface35";
	rename -uid "5FEA68DF-452F-0987-DE3D-FAA48CD3E08C";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface27" -p "group11";
	rename -uid "3799010E-4ADB-F509-7919-55B93B71EACF";
	setAttr ".t" -type "double3" 7.400053355199816 -7.4000265598297119 0 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape27" -p "polySurface27";
	rename -uid "8D7D2179-481D-DBC0-F91C-DC922AE2DC10";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape63" -p "polySurface27";
	rename -uid "7901E74C-4DEF-FF41-4588-75A6622F077A";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pCube1_1M_Ref4" -p "group11";
	rename -uid "792DB2C1-471C-6367-7327-B482D677EAC2";
	setAttr ".t" -type "double3" 524.49996958195038 0 379.25 ;
	setAttr ".s" -type "double3" 1.8 2.1 1.26 ;
	setAttr ".rp" -type "double3" 119.00003041804966 0 116.75000000000003 ;
	setAttr ".sp" -type "double3" 50.000012780689815 0 49.99999999998289 ;
	setAttr ".spt" -type "double3" 69.000017637359846 0 66.750000000017124 ;
createNode mesh -n "pCube1_1M_Ref4Shape" -p "pCube1_1M_Ref4";
	rename -uid "F64EE861-4D7F-FD4C-B993-31A038B1665E";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 3 "f[0]" "f[9]" "f[14:15]";
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 6 "f[3:4]" "f[6:8]" "f[10:12]" "f[16]" "f[18]" "f[20]";
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "f[16]";
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 4 "f[1:2]" "f[5]" "f[13]" "f[17]";
	setAttr ".pv" -type "double2" 0.79687345027923584 0.17187343537807465 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 35 ".uvst[0].uvsp[0:34]" -type "float2" 0.375 0 0.625 0.5
		 0.375 0.75 0.375 0.43749374 0.31249383 0.24999997 0.18750624 -7.4505806e-09 0.7187469
		 0.34374687 0.375 0.3125062 0.3124938 0 0.375 0.24999999 0.125 0 0.18750626 0.24999997
		 0.125 0.24999999 0.625 0.75 0.81249374 0 0.375 0.5 0.375 0.12499999 0.3124938 0.12499999
		 0.18750626 0.12499999 0.125 0.12499999 0.375 0.625 0.625 0.625 0.81249374 0.12499999
		 0.3124938 0.12499999 0.18750626 0.12499999 0.18750624 -7.4505806e-09 0.3124938 0
		 0.5 0 0.5 0.125 0.5 0.25 0.5 0.3125062 0.5 0.43749374 0.5 0.5 0.5 0.625 0.5 0.75;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 30 ".vt[0:29]"  -50 0 50 -50 99.99994659 50 -50 99.99994659 -50
		 50.00015258789 99.99994659 -50 -50 0 -50 50.00015258789 0 -50 -50 99.99994659 -35.31741333
		 -50 99.99994659 35.3175354 -50 0 35.3175354 -50 0 -35.31741333 50.00015258789 0 -35.31741333
		 50.00015258789 99.99994659 -35.31741333 -50 92.77870178 50 -50 92.77870178 35.3175354
		 -50 92.77870178 -35.31741333 -50 92.77870178 -50 50.00015258789 92.77870178 -50 50.00015258789 92.77870178 -35.31741333
		 -45.55548096 92.77870178 35.3175354 -45.55548096 92.77870178 -35.31741333 -45.55548096 0 -35.31741333
		 -45.55548096 0 35.3175354 -45.55548096 0 50 -45.55548096 92.77870178 50 -45.55548096 99.99994659 50
		 -45.55548096 99.99994659 35.3175354 -45.55548096 99.99994659 -35.31741333 -45.55548096 99.99994659 -50
		 -45.55548096 92.77870178 -50 -45.55548096 0 -50;
	setAttr -s 51 ".ed[0:50]"  1 24 0 2 27 0 4 29 0 0 12 0 2 15 0 3 16 0
		 6 7 0 7 25 1 11 26 0 6 14 1 8 13 0 10 17 0 7 1 0 0 8 0 4 9 0 6 2 0 3 11 0 12 1 0
		 13 7 1 14 9 0 15 4 0 16 5 0 17 11 0 12 13 1 13 14 0 14 15 1 15 28 1 13 18 0 14 19 0
		 18 19 0 9 20 0 19 20 0 8 21 0 21 18 0 26 6 1 27 3 0 28 16 1 29 5 0 22 23 0 23 24 0
		 24 25 0 25 26 0 26 27 1 27 28 1 28 29 1 17 19 0 10 20 0 25 18 0 26 19 0 23 18 0 21 22 0;
	setAttr -s 21 -ch 84 ".fc[0:20]" -type "polyFaces" 
		f 4 26 44 -3 -21
		mu 0 4 20 33 34 2
		f 4 6 7 41 34
		mu 0 4 3 7 30 31
		f 4 0 40 -8 12
		mu 0 4 9 29 30 7
		f 4 23 -11 -14 3
		mu 0 4 16 17 8 0
		f 4 14 -20 25 20
		mu 0 4 10 5 18 19
		f 4 -35 42 -2 -16
		mu 0 4 3 31 32 15
		f 4 -19 -24 17 -13
		mu 0 4 4 17 16 9
		f 4 -7 9 -25 18
		mu 0 4 4 11 18 17
		f 4 -26 -10 15 4
		mu 0 4 19 18 11 12
		f 4 1 43 -27 -5
		mu 0 4 15 32 33 20
		f 4 24 28 -30 -28
		mu 0 4 17 18 24 23
		f 4 19 30 -32 -29
		mu 0 4 18 5 25 24
		f 4 10 27 -34 -33
		mu 0 4 8 17 23 26
		f 4 -43 -9 -17 -36
		mu 0 4 32 31 6 1
		f 4 -44 35 5 -37
		mu 0 4 33 32 1 21
		f 4 -45 36 21 -38
		mu 0 4 34 33 21 13
		f 4 11 45 31 -47
		mu 0 4 14 22 24 25
		f 4 8 48 -46 22
		mu 0 4 6 31 24 22
		f 4 -42 47 29 -49
		mu 0 4 31 30 23 24
		f 4 -40 49 -48 -41
		mu 0 4 29 28 23 30
		f 4 33 -50 -39 -51
		mu 0 4 26 23 28 27;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 1 
		6 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface9" -p "group11";
	rename -uid "23247E78-4F75-F443-D2C3-C18FAE59ECA5";
	setAttr ".t" -type "double3" -4 0 -85 ;
	setAttr ".rp" -type "double3" 226.5 100.00025177001953 -411 ;
	setAttr ".sp" -type "double3" 226.5 100.00025177001953 -411 ;
createNode mesh -n "polySurfaceShape9" -p "polySurface9";
	rename -uid "4EC56D2E-44DD-B573-6E1A-DC8BAFE9FA76";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 19 18 -17 -15
		mu 0 4 16 19 18 17
		f 4 16 24 -24 -22
		mu 0 4 17 18 21 20
		f 4 23 29 -29 -27
		mu 0 4 20 21 23 22
		f 4 28 -32 -20 30
		mu 0 4 22 23 19 16
		f 4 3 5 -7 -5
		mu 0 4 8 9 10 11
		f 4 2 7 -9 -6
		mu 0 4 9 12 13 10
		f 4 0 9 -11 -8
		mu 0 4 12 14 15 13
		f 4 -2 4 11 -10
		mu 0 4 14 8 11 15
		f 4 12 14 -14 -4
		mu 0 4 2 16 17 3
		f 4 15 -19 -18 6
		mu 0 4 5 18 19 4
		f 4 13 21 -21 -3
		mu 0 4 3 17 20 0
		f 4 22 -25 -16 8
		mu 0 4 6 21 18 5
		f 4 20 26 -26 -1
		mu 0 4 0 20 22 1
		f 4 27 -30 -23 10
		mu 0 4 7 23 21 6
		f 4 25 -31 -13 1
		mu 0 4 1 22 16 2
		f 4 17 31 -28 -12
		mu 0 4 4 19 23 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface30" -p "group11";
	rename -uid "BFE11D60-4BDC-2978-041A-5EB860B3F80C";
	setAttr ".t" -type "double3" 128.08591042732394 -108.62141101455563 -0.53675419515843714 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376218047 -7.4000228376218047 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape30" -p "polySurface30";
	rename -uid "6853DFF9-43F8-5DF5-2240-0CB37C1BC663";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface40" -p "group11";
	rename -uid "56D62B1C-4613-3948-2891-46A2B155500D";
	setAttr ".t" -type "double3" 935.56289602049753 -1041.6233136592712 43.41100796964588 ;
	setAttr ".r" -type "double3" 90 0 90 ;
	setAttr ".s" -type "double3" 1 1.657491075826123 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -3.0662759821607684 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -653.57562637329102 820.63313999583261 -167.05751362254162 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.2163257610819214 0 ;
createNode mesh -n "polySurfaceShape40" -p "polySurface40";
	rename -uid "E85D0DB7-4A27-26A9-B1BB-37B3FA426B8F";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape70" -p "polySurface40";
	rename -uid "B2158463-4C33-06F8-2F5A-92A9EA60D971";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface49" -p "group11";
	rename -uid "9B63D623-4D78-0A32-2742-1D9AB0B52791";
	setAttr ".t" -type "double3" -9.7875213623046875 0 96.831124407873915 ;
	setAttr ".s" -type "double3" 1 1 0.95248544414508485 ;
	setAttr ".rp" -type "double3" 232.28752136230469 100.00025177001952 358.61076972062443 ;
	setAttr ".sp" -type "double3" 232.28752136230469 100.00025177001952 376.5 ;
	setAttr ".spt" -type "double3" 0 0 -17.889230279375575 ;
createNode mesh -n "polySurfaceShape49" -p "polySurface49";
	rename -uid "8EFD7E36-46A0-A5D2-5B54-658DD695C333";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".pt[0:15]" -type "float3"  5.7875214 -1.8651747e-14 
		660 5.7875214 -2.8421709e-14 660 5.7875214 -1.8651747e-14 830 5.7875214 -2.8421709e-14 
		830 5.7875214 -1.8651747e-14 820 5.7875214 -2.8421709e-14 820 5.7875214 -2.8421709e-14 
		670 5.7875214 -1.8651747e-14 670 5.7875214 -1.8651747e-14 830 5.7875214 -2.8421709e-14 
		830 5.7875214 -2.8421709e-14 820 5.7875214 -1.8651747e-14 820 5.7875214 -2.8421709e-14 
		660 5.7875214 -2.8421709e-14 670 5.7875214 -1.8651747e-14 660 5.7875214 -1.8651747e-14 
		670;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 14 16 -19 -20
		mu 0 4 16 17 18 19
		f 4 21 23 -25 -17
		mu 0 4 17 20 21 18
		f 4 26 28 -30 -24
		mu 0 4 20 22 23 21
		f 4 -31 19 31 -29
		mu 0 4 22 16 19 23
		f 4 4 6 -6 -4
		mu 0 4 8 11 10 9
		f 4 5 8 -8 -3
		mu 0 4 9 10 13 12
		f 4 7 10 -10 -1
		mu 0 4 12 13 15 14
		f 4 9 -12 -5 1
		mu 0 4 14 15 11 8
		f 4 3 13 -15 -13
		mu 0 4 2 3 17 16
		f 4 -7 17 18 -16
		mu 0 4 5 4 19 18
		f 4 2 20 -22 -14
		mu 0 4 3 0 20 17
		f 4 -9 15 24 -23
		mu 0 4 6 5 18 21
		f 4 0 25 -27 -21
		mu 0 4 0 1 22 20
		f 4 -11 22 29 -28
		mu 0 4 7 6 21 23
		f 4 -2 12 30 -26
		mu 0 4 1 2 16 22
		f 4 11 27 -32 -18
		mu 0 4 4 7 23 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape85" -p "polySurface49";
	rename -uid "811A6BC5-4C0A-C898-3D5A-B7B793A37713";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface29" -p "group11";
	rename -uid "3A56721F-4158-B9DD-FDC7-BCAD164B2F11";
	setAttr ".t" -type "double3" 59.107930769910809 -50.768347141125282 -0.22997243254857835 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376218047 -7.4000228376218047 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape29" -p "polySurface29";
	rename -uid "D970287F-4AC3-2D81-EF6C-348F39A31983";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface17" -p "group11";
	rename -uid "5E47CE57-44BA-E2D3-455A-3882CE4C820D";
	setAttr ".t" -type "double3" 434.9999899529659 0 -6.20001220703125 ;
	setAttr ".rp" -type "double3" -73.336715698242188 209.31364440901402 -493.79998779296875 ;
	setAttr ".sp" -type "double3" -73.336715698242188 209.31364440901402 -493.79998779296875 ;
createNode mesh -n "polySurfaceShape26" -p "polySurface17";
	rename -uid "20352A85-4D01-EDDE-B3B3-7C85EBC33EDC";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:185]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 2 "e[1]" "e[7]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 2 "e[1]" "e[7]";
	setAttr ".pv" -type "double2" 0.20018956437706947 0.923898845911026 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 234 ".uvst[0].uvsp[0:233]" -type "float2" 0.39730492 0.5 0.52973998
		 1 0.12039585 1 0.090296879 0.5 0.26486999 0 0.060197927 0 0.32506791 1 0.24380091
		 0.5 0.16253395 0 0.37743968 0.42500001 0.23161086 0.42500001 0.085782036 0.42500001
		 0.48219579 0.82050002 0.29589307 0.82050002 0.10959032 0.82050002 0.46974689 0.77349997
		 0.28825393 0.77349997 0.10676102 0.77349997 0.45729801 0.72650009 0.28061485 0.72650009
		 0.10393172 0.72650009 0.44484907 0.67949998 0.27297574 0.67949998 0.1011024 0.67949998
		 0.39730492 0.5 0.44484907 0.67949998 0.27297574 0.67949998 0.24380091 0.5 0.26486999
		 0 0.37743968 0.42500001 0.23161086 0.42500001 0.16253395 0 0.24380091 0.5 0.27297574
		 0.67949998 0.1011024 0.67949998 0.090296879 0.5 0.16253395 0 0.23161086 0.42500001
		 0.085782036 0.42500001 0.060197927 0 0.23161086 0.42500001 0.37743968 0.42500001
		 0.39730492 0.5 0.24380091 0.5 0.085782036 0.42500001 0.23161086 0.42500001 0.24380091
		 0.5 0.090296879 0.5 0.29589307 0.82050002 0.48219579 0.82050002 0.52973998 1 0.32506791
		 1 0.10959032 0.82050002 0.29589307 0.82050002 0.32506791 1 0.12039585 1 0.28825393
		 0.77349997 0.46974689 0.77349997 0.48219579 0.82050002 0.29589307 0.82050002 0.10676102
		 0.77349997 0.28825393 0.77349997 0.29589307 0.82050002 0.10959032 0.82050002 0.28061485
		 0.72650009 0.45729801 0.72650009 0.46974689 0.77349997 0.28825393 0.77349997 0.10393172
		 0.72650009 0.28061485 0.72650009 0.28825393 0.77349997 0.10676102 0.77349997 0.27297574
		 0.67949998 0.44484907 0.67949998 0.45729801 0.72650009 0.28061485 0.72650009 0.1011024
		 0.67949998 0.27297574 0.67949998 0.28061485 0.72650009 0.10393172 0.72650009 0.39730492
		 0.5 0.44484907 0.67949998 0.44484907 0.67949998 0.39730492 0.5 0.27297574 0.67949998
		 0.27297574 0.67949998 0.24380091 0.5 0.24380091 0.5 0.26486999 0 0.37743968 0.42500001
		 0.37743968 0.42500001 0.26486999 0 0.23161086 0.42500001 0.23161086 0.42500001 0.16253395
		 0 0.16253395 0 0.27297574 0.67949998 0.24380091 0.5 0.1011024 0.67949998 0.1011024
		 0.67949998 0.090296879 0.5 0.090296879 0.5 0.23161086 0.42500001 0.16253395 0 0.085782036
		 0.42500001 0.085782036 0.42500001 0.060197927 0 0.060197927 0 0.37743968 0.42500001
		 0.23161086 0.42500001 0.39730492 0.5 0.24380091 0.5 0.23161086 0.42500001 0.085782036
		 0.42500001 0.24380091 0.5 0.090296879 0.5 0.29589307 0.82050002 0.48219579 0.82050002
		 0.48219579 0.82050002 0.29589307 0.82050002 0.52973998 1 0.52973998 1 0.32506791
		 1 0.32506791 1 0.10959032 0.82050002 0.29589307 0.82050002 0.10959032 0.82050002
		 0.32506791 1 0.12039585 1 0.12039585 1 0.28825393 0.77349997 0.46974689 0.77349997
		 0.46974689 0.77349997 0.28825393 0.77349997 0.48219579 0.82050002 0.29589307 0.82050002
		 0.10676102 0.77349997 0.28825393 0.77349997 0.10676102 0.77349997 0.29589307 0.82050002
		 0.10959032 0.82050002 0.28061485 0.72650009 0.45729801 0.72650009 0.45729801 0.72650009
		 0.28061485 0.72650009 0.46974689 0.77349997 0.28825393 0.77349997 0.10393172 0.72650009
		 0.28061485 0.72650009 0.10393172 0.72650009 0.28825393 0.77349997 0.10676102 0.77349997
		 0.44484907 0.67949998 0.27297574 0.67949998 0.45729801 0.72650009 0.28061485 0.72650009
		 0.27297574 0.67949998 0.1011024 0.67949998 0.28061485 0.72650009 0.10393172 0.72650009
		 0.39730492 0.5 0.44484907 0.67949998 0.44484907 0.67949998 0.39730492 0.5 0.27297574
		 0.67949998 0.24380091 0.5 0.26486999 0 0.37743968 0.42500001 0.37743968 0.42500001
		 0.26486999 0 0.23161086 0.42500001 0.16253395 0 0.16253395 0 0.27297574 0.67949998
		 0.24380091 0.5 0.1011024 0.67949998 0.1011024 0.67949998 0.090296879 0.5 0.090296879
		 0.5 0.23161086 0.42500001 0.16253395 0 0.085782036 0.42500001 0.085782036 0.42500001
		 0.060197927 0 0.060197927 0 0.37743968 0.42500001 0.23161086 0.42500001 0.39730492
		 0.5 0.24380091 0.5 0.23161086 0.42500001 0.085782036 0.42500001 0.24380091 0.5 0.090296879
		 0.5 0.48219579 0.82050002 0.29589307 0.82050002 0.48219579 0.82050002 0.52973998
		 1 0.52973998 1 0.32506791 1 0.32506791 1 0.29589307 0.82050002 0.10959032 0.82050002
		 0.32506791 1 0.12039585 1 0.12039585 1 0.10959032 0.82050002 0.46974689 0.77349997
		 0.28825393 0.77349997 0.46974689 0.77349997 0.48219579 0.82050002 0.29589307 0.82050002
		 0.28825393 0.77349997 0.10676102 0.77349997 0.29589307 0.82050002 0.10959032 0.82050002
		 0.10676102 0.77349997 0.45729801 0.72650009 0.28061485 0.72650009 0.45729801 0.72650009
		 0.46974689 0.77349997 0.28825393 0.77349997 0.28061485 0.72650009 0.10393172 0.72650009
		 0.28825393 0.77349997 0.10676102 0.77349997 0.10393172 0.72650009 0.44484907 0.67949998
		 0.27297574 0.67949998 0.45729801 0.72650009 0.28061485 0.72650009 0.27297574 0.67949998
		 0.1011024 0.67949998 0.28061485 0.72650009 0.10393172 0.72650009;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 160 ".vt[0:159]"  12.14532471 199.99996948 -496 12.19659424 335.4989624 -496
		 -158.67834473 418.62728882 -495.99996948 -158.77416992 200.00039672852 -496 12.094116211 1.9388252e-14 -496
		 -158.87002563 1.1974303e-14 -495.99996948 -73.24087524 377.063110352 -496 -73.31442261 200.00018310547 -496
		 -73.38793945 1.5681277e-14 -496 12.13763428 169.99998474 -496 -73.32543945 170.00016784668 -496
		 -158.78857422 170.00033569336 -496 12.17819214 320.0009765625 -496 -73.26727295 320.0011901855 -496
		 -158.71276855 320.0014648438 -496 12.17337036 290.0007019043 -496 -73.27420044 290.00091552734 -496
		 -158.72174072 290.0011291504 -496 12.16854858 260.00048828125 -496 -73.28109741 260.00064086914 -496
		 -158.73074341 260.00079345703 -496 12.16372681 230.00028991699 -496 -73.2880249 230.00042724609 -496
		 -158.73974609 230.00064086914 -496 10.1625061 228.00028991699 -496 10.14654541 201.99996948 -496
		 -71.28979492 228.00042724609 -496 -71.31265259 202.00018310547 -496 10.13711548 167.99998474 -496
		 10.09463501 2 -496 -71.32617188 168.00016784668 -496 -71.38720703 2 -496 -75.28979492 228.00042724609 -496
		 -75.31265259 202.00018310547 -496 -156.74203491 228.00064086914 -496 -156.7718811 202.00039672852 -496
		 -75.32617188 168.00016784668 -496 -75.38720703 2 -496 -156.78952026 168.00033569336 -496
		 -156.86907959 2.000000238419 -495.99996948 10.13815308 171.99998474 -496 -71.32470703 172.00016784668 -496
		 10.14480591 197.99996948 -496 -71.31515503 198.00018310547 -496 -75.32470703 172.00016784668 -496
		 -156.78762817 172.00033569336 -496 -75.31515503 198.00018310547 -496 -156.77511597 198.00039672852 -496
		 10.18057251 322.0009765625 -496 -71.26635742 322.0011901855 -496 10.19509888 334.24853516 -496
		 -71.24234009 373.86676025 -496 -75.26635742 322.0011901855 -496 -156.71206665 322.0014648438 -496
		 -75.24145508 375.81225586 -496 -156.67947388 415.43075562 -495.99996948 10.17370605 292.0007019043 -496
		 -71.27374268 292.00091552734 -496 10.17785645 318.0009765625 -496 -71.26773071 318.0011901855 -496
		 -75.27374268 292.00091552734 -496 -156.72113037 292.0011291504 -496 -75.26773071 318.0011901855 -496
		 -156.71337891 318.0014648438 -496 10.16888428 262.00048828125 -496 -71.28063965 262.00064086914 -496
		 10.17303467 288.0007019043 -496 -71.2746582 288.00091552734 -496 -75.28063965 262.00064086914 -496
		 -156.73013306 262.00079345703 -496 -75.2746582 288.00091552734 -496 -156.72235107 288.0011291504 -496
		 10.1640625 232.00028991699 -496 -71.28756714 232.00042724609 -496 10.16821289 258.00048828125 -496
		 -71.28155518 258.00064086914 -496 -75.28756714 232.00042724609 -496 -156.73913574 232.00064086914 -496
		 -75.28155518 258.00064086914 -496 -156.73135376 258.00079345703 -496 12.16372681 230.00028991699 -493.79998779
		 12.14532471 199.99996948 -493.79998779 10.1625061 228.00028991699 -493.79998779 10.14654541 201.99996948 -493.79998779
		 -73.2880249 230.00042724609 -493.79998779 -71.28979492 228.00042724609 -493.79998779
		 -73.31442261 200.00018310547 -493.79998779 -71.31265259 202.00018310547 -493.79998779
		 12.13763428 169.99998474 -493.79998779 12.094116211 1.9388252e-14 -493.79998779 10.13711548 167.99998474 -493.79998779
		 10.09463501 2 -493.79998779 -73.32543945 170.00016784668 -493.79998779 -71.32617188 168.00016784668 -493.79998779
		 -73.38793945 1.5681277e-14 -493.79998779 -71.38720703 2 -493.79998779 -75.28979492 228.00042724609 -493.79998779
		 -75.31265259 202.00018310547 -493.79998779 -158.73974609 230.00064086914 -493.79998779
		 -156.74203491 228.00064086914 -493.79998779 -158.77416992 200.00039672852 -493.79998779
		 -156.7718811 202.00039672852 -493.79998779 -75.32617188 168.00016784668 -493.79998779
		 -75.38720703 2 -493.79998779 -158.78857422 170.00033569336 -493.79998779 -156.78952026 168.00033569336 -493.79998779
		 -158.87002563 -3.3132039e-10 -493.79995728 -156.86907959 2.000000715256 -493.79995728
		 10.13815308 171.99998474 -493.79998779 -71.32470703 172.00016784668 -493.79998779
		 10.14480591 197.99996948 -493.79998779 -71.31515503 198.00018310547 -493.79998779
		 -75.32470703 172.00016784668 -493.79998779 -156.78762817 172.00033569336 -493.79998779
		 -75.31515503 198.00018310547 -493.79998779 -156.77511597 198.00039672852 -493.79998779
		 12.17819214 320.0009765625 -493.79998779 -73.26727295 320.0011901855 -493.79998779
		 10.18057251 322.0009765625 -493.79998779 -71.26638794 322.0011901855 -493.79998779
		 12.19656372 335.4989624 -493.79998779 10.19506836 334.24853516 -493.79998779 -73.24087524 377.063110352 -493.79998779
		 -71.24237061 373.86676025 -493.79998779 -158.71276855 320.0014648438 -493.79998779
		 -75.26635742 322.0011901855 -493.79998779 -156.71206665 322.0014648438 -493.79998779
		 -75.24145508 375.81225586 -493.79998779 -158.67834473 418.62728882 -493.79995728
		 -156.67947388 415.43075562 -493.79995728 12.17337036 290.0007019043 -493.79998779
		 -73.27420044 290.00091552734 -493.79998779 10.17370605 292.0007019043 -493.79998779
		 -71.27374268 292.00091552734 -493.79998779 10.17785645 318.0009765625 -493.79998779
		 -71.26773071 318.0011901855 -493.79998779 -158.72174072 290.0011291504 -493.79998779
		 -75.27374268 292.00091552734 -493.79998779 -156.72113037 292.0011291504 -493.79998779
		 -75.26773071 318.0011901855 -493.79998779 -156.71337891 318.0014648438 -493.79998779
		 12.16854858 260.00048828125 -493.79998779 -73.28109741 260.00064086914 -493.79998779
		 10.16888428 262.00048828125 -493.79998779 -71.28063965 262.00064086914 -493.79998779
		 10.17303467 288.0007019043 -493.79998779 -71.2746582 288.00091552734 -493.79998779
		 -158.73074341 260.00079345703 -493.79998779 -75.28063965 262.00064086914 -493.79998779
		 -156.73013306 262.00079345703 -493.79998779 -75.2746582 288.00091552734 -493.79998779
		 -156.72235107 288.0011291504 -493.79998779 10.1640625 232.00028991699 -493.79998779
		 -71.28756714 232.00042724609 -493.79998779 10.16821289 258.00048828125 -493.79998779
		 -71.28155518 258.00064086914 -493.79998779 -75.28756714 232.00042724609 -493.79998779
		 -156.73913574 232.00064086914 -493.79998779 -75.28155518 258.00064086914 -493.79998779
		 -156.73135376 258.00079345703 -493.79998779;
	setAttr -s 372 ".ed";
	setAttr ".ed[0:165]"  1 12 0 2 6 0 2 14 0 0 7 1 0 9 0 3 11 0 5 8 0 6 1 0
		 7 3 1 8 4 0 6 13 1 7 10 1 9 4 0 10 8 1 11 5 0 9 10 1 10 11 1 12 15 0 13 16 1 14 17 0
		 12 13 1 13 14 1 15 18 0 16 19 1 17 20 0 15 16 1 16 17 1 18 21 0 19 22 1 20 23 0 18 19 1
		 19 20 1 21 0 0 22 7 1 23 3 0 21 22 1 22 23 1 21 24 0 0 25 0 24 25 0 22 26 0 24 26 0
		 7 27 0 26 27 0 25 27 0 9 28 0 4 29 0 28 29 0 10 30 0 28 30 0 8 31 0 30 31 0 31 29 0
		 22 32 0 7 33 0 32 33 0 23 34 0 32 34 0 3 35 0 34 35 0 33 35 0 10 36 0 8 37 1 36 37 0
		 11 38 1 36 38 0 5 39 1 38 39 0 39 37 0 9 40 1 10 41 1 40 41 0 0 42 1 42 40 0 7 43 1
		 42 43 0 43 41 0 10 44 1 11 45 1 44 45 0 7 46 1 46 44 0 3 47 1 46 47 0 47 45 0 12 48 1
		 13 49 1 48 49 0 1 50 1 50 48 0 6 51 1 51 50 0 51 49 0 13 52 1 14 53 1 52 53 0 6 54 1
		 54 52 0 2 55 1 55 54 0 55 53 0 15 56 1 16 57 1 56 57 0 12 58 1 58 56 0 13 59 1 58 59 0
		 59 57 0 16 60 1 17 61 1 60 61 0 13 62 1 62 60 0 14 63 1 62 63 0 63 61 0 18 64 1 19 65 1
		 64 65 0 15 66 1 66 64 0 16 67 1 66 67 0 67 65 0 19 68 1 20 69 1 68 69 0 16 70 1 70 68 0
		 17 71 1 70 71 0 71 69 0 21 72 1 22 73 1 72 73 0 18 74 1 74 72 0 19 75 1 74 75 0 75 73 0
		 22 76 1 23 77 1 76 77 0 19 78 1 78 76 0 20 79 1 78 79 0 79 77 0 21 80 1 0 81 1 80 81 0
		 24 82 0 80 82 0 25 83 0 82 83 0 81 83 0 80 84 1 26 85 0 84 85 0 82 85 0 84 86 1 27 87 0
		 86 87 0 85 87 0 81 86 1;
	setAttr ".ed[166:331]" 83 87 0 9 88 1 4 89 0 88 89 0 28 90 0 88 90 0 29 91 0
		 90 91 0 89 91 0 88 92 1 30 93 0 92 93 0 90 93 0 8 94 1 92 94 1 31 95 0 94 95 0 93 95 0
		 94 89 0 95 91 0 32 96 0 84 96 0 33 97 0 96 97 0 86 97 0 23 98 1 84 98 1 34 99 0 98 99 0
		 96 99 0 3 100 1 98 100 0 35 101 0 100 101 0 99 101 0 86 100 1 97 101 0 36 102 0 92 102 0
		 37 103 0 102 103 0 94 103 1 11 104 1 92 104 1 38 105 0 104 105 1 102 105 0 5 106 0
		 104 106 0 39 107 0 106 107 1 105 107 0 106 94 0 107 103 0 40 108 0 88 108 1 41 109 0
		 108 109 0 92 109 1 81 88 0 42 110 0 81 110 1 110 108 0 43 111 0 86 111 1 110 111 0
		 86 92 1 111 109 0 44 112 0 92 112 1 45 113 0 112 113 0 104 113 1 46 114 0 86 114 1
		 114 112 0 47 115 0 100 115 1 114 115 0 100 104 0 115 113 0 12 116 1 116 117 1 48 118 0
		 116 118 1 49 119 0 118 119 0 117 119 1 1 120 0 120 116 0 50 121 0 120 121 1 121 118 0
		 6 122 1 122 120 0 51 123 0 122 123 1 123 121 0 122 117 1 123 119 0 14 124 1 117 124 1
		 52 125 0 117 125 1 53 126 0 125 126 0 124 126 1 54 127 0 122 127 1 127 125 0 2 128 0
		 128 122 0 55 129 0 128 129 1 129 127 0 128 124 0 129 126 0 15 130 1 130 131 1 56 132 0
		 130 132 1 57 133 0 132 133 0 131 133 1 116 130 0 58 134 0 116 134 1 134 132 0 59 135 0
		 117 135 1 134 135 0 117 131 1 135 133 0 17 136 1 131 136 1 60 137 0 131 137 1 61 138 0
		 137 138 0 136 138 1 62 139 0 117 139 1 139 137 0 63 140 0 124 140 1 139 140 0 124 136 0
		 140 138 0 18 141 1 141 142 1 64 143 0 141 143 1 65 144 0 143 144 0 142 144 1 130 141 0
		 66 145 0 130 145 1 145 143 0 67 146 0 131 146 1 145 146 0 131 142 1 146 144 0 20 147 1
		 142 147 1;
	setAttr ".ed[332:371]" 68 148 0 142 148 1 69 149 0 148 149 0 147 149 1 70 150 0
		 131 150 1 150 148 0 71 151 0 136 151 1 150 151 0 136 147 0 151 149 0 72 152 0 80 152 1
		 73 153 0 152 153 0 84 153 1 141 80 0 74 154 0 141 154 1 154 152 0 75 155 0 142 155 1
		 154 155 0 142 84 1 155 153 0 76 156 0 84 156 1 77 157 0 156 157 0 98 157 1 78 158 0
		 142 158 1 158 156 0 79 159 0 147 159 1 158 159 0 147 98 0 159 157 0;
	setAttr -s 186 -ch 744 ".fc[0:185]" -type "polyFaces" 
		f 4 -152 153 155 -157
		mu 0 4 160 161 162 163
		f 4 157 159 -161 -154
		mu 0 4 161 22 164 162
		f 4 161 163 -165 -160
		mu 0 4 22 7 165 164
		f 4 -166 156 166 -164
		mu 0 4 7 160 163 165
		f 4 -170 171 173 -175
		mu 0 4 166 167 168 169
		f 4 175 177 -179 -172
		mu 0 4 167 10 170 168
		f 4 180 182 -184 -178
		mu 0 4 10 172 171 170
		f 4 184 174 -186 -183
		mu 0 4 172 166 169 171
		f 4 -162 187 189 -191
		mu 0 4 7 22 173 174
		f 4 192 194 -196 -188
		mu 0 4 22 176 175 173
		f 4 197 199 -201 -195
		mu 0 4 176 177 178 175
		f 4 -202 190 202 -200
		mu 0 4 177 7 174 178
		f 4 -181 204 206 -208
		mu 0 4 172 10 179 180
		f 4 209 211 -213 -205
		mu 0 4 10 182 181 179
		f 4 214 216 -218 -212
		mu 0 4 182 183 184 181
		f 4 218 207 -220 -217
		mu 0 4 183 172 180 184
		f 4 -176 221 223 -225
		mu 0 4 10 167 185 186
		f 4 -226 227 228 -222
		mu 0 4 167 160 187 185
		f 4 165 230 -232 -228
		mu 0 4 160 7 188 187
		f 4 232 224 -234 -231
		mu 0 4 7 10 186 188
		f 4 -210 235 237 -239
		mu 0 4 182 10 189 190
		f 4 -233 240 241 -236
		mu 0 4 10 7 191 189
		f 4 201 243 -245 -241
		mu 0 4 7 177 192 191
		f 4 245 238 -247 -244
		mu 0 4 177 182 190 192
		f 4 -249 250 252 -254
		mu 0 4 13 195 193 194
		f 4 -256 257 258 -251
		mu 0 4 195 196 197 193
		f 4 -261 262 263 -258
		mu 0 4 196 198 199 197
		f 4 264 253 -266 -263
		mu 0 4 198 13 194 199
		f 4 -268 269 271 -273
		mu 0 4 205 13 200 201
		f 4 -265 274 275 -270
		mu 0 4 13 198 202 200
		f 4 -278 279 280 -275
		mu 0 4 198 203 204 202
		f 4 281 272 -283 -280
		mu 0 4 203 205 201 204
		f 4 -285 286 288 -290
		mu 0 4 16 208 206 207
		f 4 -291 292 293 -287
		mu 0 4 208 195 209 206
		f 4 248 295 -297 -293
		mu 0 4 195 13 210 209
		f 4 297 289 -299 -296
		mu 0 4 13 16 207 210
		f 4 -301 302 304 -306
		mu 0 4 215 16 211 212
		f 4 -298 307 308 -303
		mu 0 4 16 13 213 211
		f 4 267 310 -312 -308
		mu 0 4 13 205 214 213
		f 4 312 305 -314 -311
		mu 0 4 205 215 212 214
		f 4 -316 317 319 -321
		mu 0 4 19 218 216 217
		f 4 -322 323 324 -318
		mu 0 4 218 208 219 216
		f 4 284 326 -328 -324
		mu 0 4 208 16 220 219
		f 4 328 320 -330 -327
		mu 0 4 16 19 217 220
		f 4 -332 333 335 -337
		mu 0 4 225 19 221 222
		f 4 -329 338 339 -334
		mu 0 4 19 16 223 221
		f 4 300 341 -343 -339
		mu 0 4 16 215 224 223
		f 4 343 336 -345 -342
		mu 0 4 215 225 222 224
		f 4 -158 346 348 -350
		mu 0 4 22 161 226 227
		f 4 -351 352 353 -347
		mu 0 4 161 218 228 226
		f 4 315 355 -357 -353
		mu 0 4 218 19 229 228
		f 4 357 349 -359 -356
		mu 0 4 19 22 227 229
		f 4 -193 360 362 -364
		mu 0 4 176 22 230 231
		f 4 -358 365 366 -361
		mu 0 4 22 19 232 230
		f 4 331 368 -370 -366
		mu 0 4 19 225 233 232
		f 4 370 363 -372 -369
		mu 0 4 225 176 231 233
		f 4 38 -40 -38 32
		mu 0 4 80 83 82 81
		f 4 37 41 -41 -36
		mu 0 4 81 82 85 84
		f 4 40 43 -43 -34
		mu 0 4 84 85 87 86
		f 4 42 -45 -39 3
		mu 0 4 86 87 83 80
		f 4 46 -48 -46 12
		mu 0 4 88 91 90 89
		f 4 45 49 -49 -16
		mu 0 4 89 90 93 92
		f 4 48 51 -51 -14
		mu 0 4 92 93 95 94
		f 4 50 52 -47 -10
		mu 0 4 94 95 91 88
		f 4 54 -56 -54 33
		mu 0 4 86 97 96 84
		f 4 53 57 -57 -37
		mu 0 4 84 96 99 98
		f 4 56 59 -59 -35
		mu 0 4 98 99 101 100
		f 4 58 -61 -55 8
		mu 0 4 100 101 97 86
		f 4 62 -64 -62 13
		mu 0 4 94 103 102 92
		f 4 61 65 -65 -17
		mu 0 4 92 102 105 104
		f 4 64 67 -67 -15
		mu 0 4 104 105 107 106
		f 4 66 68 -63 -7
		mu 0 4 106 107 103 94
		f 4 70 -72 -70 15
		mu 0 4 92 109 108 89
		f 4 69 -74 -73 4
		mu 0 4 89 108 110 80
		f 4 72 75 -75 -4
		mu 0 4 80 110 111 86
		f 4 74 76 -71 -12
		mu 0 4 86 111 109 92
		f 4 78 -80 -78 16
		mu 0 4 104 113 112 92
		f 4 77 -82 -81 11
		mu 0 4 92 112 114 86
		f 4 80 83 -83 -9
		mu 0 4 86 114 115 100
		f 4 82 84 -79 -6
		mu 0 4 100 115 113 104
		f 4 86 -88 -86 20
		mu 0 4 116 119 118 117
		f 4 85 -90 -89 0
		mu 0 4 117 118 121 120
		f 4 88 -92 -91 7
		mu 0 4 120 121 123 122
		f 4 90 92 -87 -11
		mu 0 4 122 123 119 116
		f 4 94 -96 -94 21
		mu 0 4 124 126 125 116
		f 4 93 -98 -97 10
		mu 0 4 116 125 127 122
		f 4 96 -100 -99 1
		mu 0 4 122 127 129 128
		f 4 98 100 -95 -3
		mu 0 4 128 129 126 124
		f 4 102 -104 -102 25
		mu 0 4 130 133 132 131
		f 4 101 -106 -105 17
		mu 0 4 131 132 134 117
		f 4 104 107 -107 -21
		mu 0 4 117 134 135 116
		f 4 106 108 -103 -19
		mu 0 4 116 135 133 130
		f 4 110 -112 -110 26
		mu 0 4 136 138 137 130
		f 4 109 -114 -113 18
		mu 0 4 130 137 139 116
		f 4 112 115 -115 -22
		mu 0 4 116 139 140 124
		f 4 114 116 -111 -20
		mu 0 4 124 140 138 136
		f 4 118 -120 -118 30
		mu 0 4 141 144 143 142
		f 4 117 -122 -121 22
		mu 0 4 142 143 145 131
		f 4 120 123 -123 -26
		mu 0 4 131 145 146 130
		f 4 122 124 -119 -24
		mu 0 4 130 146 144 141
		f 4 126 -128 -126 31
		mu 0 4 147 149 148 141
		f 4 125 -130 -129 23
		mu 0 4 141 148 150 130
		f 4 128 131 -131 -27
		mu 0 4 130 150 151 136
		f 4 130 132 -127 -25
		mu 0 4 136 151 149 147
		f 4 134 -136 -134 35
		mu 0 4 84 153 152 81
		f 4 133 -138 -137 27
		mu 0 4 81 152 154 142
		f 4 136 139 -139 -31
		mu 0 4 142 154 155 141
		f 4 138 140 -135 -29
		mu 0 4 141 155 153 84
		f 4 142 -144 -142 36
		mu 0 4 98 157 156 84
		f 4 141 -146 -145 28
		mu 0 4 84 156 158 141
		f 4 144 147 -147 -32
		mu 0 4 141 158 159 147
		f 4 146 148 -143 -30
		mu 0 4 147 159 157 98
		f 4 -33 149 151 -151
		mu 0 4 0 21 161 160
		f 4 39 154 -156 -153
		mu 0 4 25 24 163 162
		f 4 -42 152 160 -159
		mu 0 4 26 25 162 164
		f 4 -44 158 164 -163
		mu 0 4 27 26 164 165
		f 4 44 162 -167 -155
		mu 0 4 24 27 165 163
		f 4 -13 167 169 -169
		mu 0 4 4 9 167 166
		f 4 47 172 -174 -171
		mu 0 4 29 28 169 168
		f 4 -50 170 178 -177
		mu 0 4 30 29 168 170
		f 4 -52 176 183 -182
		mu 0 4 31 30 170 171
		f 4 9 168 -185 -180
		mu 0 4 8 4 166 172
		f 4 -53 181 185 -173
		mu 0 4 28 31 171 169
		f 4 55 188 -190 -187
		mu 0 4 33 32 174 173
		f 4 -58 186 195 -194
		mu 0 4 34 33 173 175
		f 4 34 196 -198 -192
		mu 0 4 23 3 177 176
		f 4 -60 193 200 -199
		mu 0 4 35 34 175 178
		f 4 60 198 -203 -189
		mu 0 4 32 35 178 174
		f 4 63 205 -207 -204
		mu 0 4 37 36 180 179
		f 4 -66 203 212 -211
		mu 0 4 38 37 179 181
		f 4 14 213 -215 -209
		mu 0 4 11 5 183 182
		f 4 -68 210 217 -216
		mu 0 4 39 38 181 184
		f 4 6 179 -219 -214
		mu 0 4 5 8 172 183
		f 4 -69 215 219 -206
		mu 0 4 36 39 184 180
		f 4 71 222 -224 -221
		mu 0 4 41 40 186 185
		f 4 -5 150 225 -168
		mu 0 4 9 0 160 167
		f 4 73 220 -229 -227
		mu 0 4 42 41 185 187
		f 4 -76 226 231 -230
		mu 0 4 43 42 187 188
		f 4 -77 229 233 -223
		mu 0 4 40 43 188 186
		f 4 79 236 -238 -235
		mu 0 4 45 44 190 189
		f 4 81 234 -242 -240
		mu 0 4 46 45 189 191
		f 4 -84 239 244 -243
		mu 0 4 47 46 191 192
		f 4 5 208 -246 -197
		mu 0 4 3 11 182 177
		f 4 -85 242 246 -237
		mu 0 4 44 47 192 190
		f 4 87 251 -253 -250
		mu 0 4 49 48 194 193
		f 4 -1 254 255 -248
		mu 0 4 12 1 196 195
		f 4 89 249 -259 -257
		mu 0 4 50 49 193 197
		f 4 -8 259 260 -255
		mu 0 4 1 6 198 196
		f 4 91 256 -264 -262
		mu 0 4 51 50 197 199
		f 4 -93 261 265 -252
		mu 0 4 48 51 199 194
		f 4 95 270 -272 -269
		mu 0 4 53 52 201 200
		f 4 97 268 -276 -274
		mu 0 4 54 53 200 202
		f 4 -2 276 277 -260
		mu 0 4 6 2 203 198
		f 4 99 273 -281 -279
		mu 0 4 55 54 202 204
		f 4 2 266 -282 -277
		mu 0 4 2 14 205 203
		f 4 -101 278 282 -271
		mu 0 4 52 55 204 201
		f 4 103 287 -289 -286
		mu 0 4 57 56 207 206
		f 4 -18 247 290 -284
		mu 0 4 15 12 195 208
		f 4 105 285 -294 -292
		mu 0 4 58 57 206 209
		f 4 -108 291 296 -295
		mu 0 4 59 58 209 210
		f 4 -109 294 298 -288
		mu 0 4 56 59 210 207
		f 4 111 303 -305 -302
		mu 0 4 61 60 212 211
		f 4 113 301 -309 -307
		mu 0 4 62 61 211 213
		f 4 -116 306 311 -310
		mu 0 4 63 62 213 214
		f 4 19 299 -313 -267
		mu 0 4 14 17 215 205
		f 4 -117 309 313 -304
		mu 0 4 60 63 214 212
		f 4 119 318 -320 -317
		mu 0 4 65 64 217 216
		f 4 -23 283 321 -315
		mu 0 4 18 15 208 218
		f 4 121 316 -325 -323
		mu 0 4 66 65 216 219
		f 4 -124 322 327 -326
		mu 0 4 67 66 219 220
		f 4 -125 325 329 -319
		mu 0 4 64 67 220 217
		f 4 127 334 -336 -333
		mu 0 4 69 68 222 221
		f 4 129 332 -340 -338
		mu 0 4 70 69 221 223
		f 4 -132 337 342 -341
		mu 0 4 71 70 223 224
		f 4 24 330 -344 -300
		mu 0 4 17 20 225 215
		f 4 -133 340 344 -335
		mu 0 4 68 71 224 222
		f 4 135 347 -349 -346
		mu 0 4 73 72 227 226
		f 4 -28 314 350 -150
		mu 0 4 21 18 218 161
		f 4 137 345 -354 -352
		mu 0 4 74 73 226 228
		f 4 -140 351 356 -355
		mu 0 4 75 74 228 229
		f 4 -141 354 358 -348
		mu 0 4 72 75 229 227
		f 4 143 361 -363 -360
		mu 0 4 77 76 231 230
		f 4 145 359 -367 -365
		mu 0 4 78 77 230 232
		f 4 -148 364 369 -368
		mu 0 4 79 78 232 233
		f 4 29 191 -371 -331
		mu 0 4 20 23 176 225
		f 4 -149 367 371 -362
		mu 0 4 76 79 233 231;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface37" -p "group11";
	rename -uid "876AD442-44B4-13D9-7B91-1B96D1A673D2";
	setAttr ".t" -type "double3" 145.34633678082014 -123.09803896554766 -0.61352049139418341 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape37" -p "polySurface37";
	rename -uid "9710F526-4137-C258-DE52-8090E34E0BBC";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape68" -p "polySurface37";
	rename -uid "0B80BE92-43DA-EDD2-B98D-828CD1A7ABE4";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface22" -p "group11";
	rename -uid "B84095A4-47CE-4AA6-ADEC-A6B6186C8124";
	setAttr ".t" -type "double3" 416.82530916640007 -1.4210854715202004e-14 456.08084703617277 ;
	setAttr ".s" -type "double3" 1 1 0.94423563755759665 ;
	setAttr ".rp" -type "double3" 226.49998474121094 100.00025177001953 -347.95083243997436 ;
	setAttr ".sp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
	setAttr ".spt" -type "double3" 0 0 20.549167560025658 ;
createNode mesh -n "polySurfaceShape22" -p "polySurface22";
	rename -uid "1335D0CF-4651-189C-A48B-D18461A4B5E4";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 1 2 -4 0
		mu 0 4 0 2 3 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape48" -p "polySurface22";
	rename -uid "893D422D-4238-FC8A-073D-91947C2E25E1";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface50" -p "group11";
	rename -uid "49BDF085-4D60-9AA4-A0DD-AF9375860D18";
	setAttr ".t" -type "double3" 419.32529390761101 -1.4210854715202004e-14 456.08084703617277 ;
	setAttr ".s" -type "double3" 1 1 0.94423563755759665 ;
	setAttr ".rp" -type "double3" 226.5 100.00025177001953 -388.08084703617226 ;
	setAttr ".sp" -type "double3" 226.5 100.00025177001953 -411 ;
	setAttr ".spt" -type "double3" 0 0 22.919152963827756 ;
createNode mesh -n "polySurfaceShape50" -p "polySurface50";
	rename -uid "2417BEB8-492D-FD8D-470B-41BAC2A26B2F";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 19 18 -17 -15
		mu 0 4 16 19 18 17
		f 4 16 24 -24 -22
		mu 0 4 17 18 21 20
		f 4 23 29 -29 -27
		mu 0 4 20 21 23 22
		f 4 28 -32 -20 30
		mu 0 4 22 23 19 16
		f 4 3 5 -7 -5
		mu 0 4 8 9 10 11
		f 4 2 7 -9 -6
		mu 0 4 9 12 13 10
		f 4 0 9 -11 -8
		mu 0 4 12 14 15 13
		f 4 -2 4 11 -10
		mu 0 4 14 8 11 15
		f 4 12 14 -14 -4
		mu 0 4 2 16 17 3
		f 4 15 -19 -18 6
		mu 0 4 5 18 19 4
		f 4 13 21 -21 -3
		mu 0 4 3 17 20 0
		f 4 22 -25 -16 8
		mu 0 4 6 21 18 5
		f 4 20 26 -26 -1
		mu 0 4 0 20 22 1
		f 4 27 -30 -23 10
		mu 0 4 7 23 21 6
		f 4 25 -31 -13 1
		mu 0 4 1 22 16 2
		f 4 17 31 -28 -12
		mu 0 4 4 19 23 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pPlane2" -p "group11";
	rename -uid "CFB10CF6-4739-D2E0-9840-02B2A516A1F3";
	setAttr ".t" -type "double3" 955.49997351813909 10 364.5 ;
	setAttr ".s" -type "double3" 4 1 2.63 ;
	setAttr ".rp" -type "double3" -199.99997351813909 0 131.5 ;
	setAttr ".sp" -type "double3" -49.999993379534772 0 50 ;
	setAttr ".spt" -type "double3" -149.99998013860431 0 81.500000000000014 ;
createNode mesh -n "pPlaneShape2" -p "pPlane2";
	rename -uid "87054555-4603-21C9-F0C1-378D6E90FF1A";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "e[0]";
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "e[0:1]";
	setAttr ".pv" -type "double2" 0.5 1 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 27 ".uvst[0].uvsp[0:26]" -type "float2" 0 0 0.5 0 1 1 0 1
		 1 0 1 1 1.8271345e-08 5.60975599 0 0 1 0 1 1 0 1 0 0 1 0 1 1 1.8271345e-08 5.60975599
		 0 0 0 0 1 0 0 0 1 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 2 ".pt[18:19]" -type "float3"  0 -235.89999 0 0 -235.89999 
		0;
	setAttr -s 20 ".vt[0:19]"  50 0 50 -50 0 -50 50 0 -50 -50 230 -50 50 230 -50
		 50 230 50 -50 0 -53.041824341 52 0 -53.041824341 52 230 -53.041824341 -50 230 -53.041824341
		 52 0 50 52 230 50 -50 -10 -50 -50 -10 -53.041824341 52 -10 -53.041824341 52 -10 50
		 -50 0 50 -50 -10 50 -50 -31.10000038 -53.041824341 52 -31.10000038 -53.041824341;
	setAttr -s 32 ".ed[0:31]"  0 2 0 1 2 0 1 3 0 3 4 0 0 5 0 5 4 0 1 6 1
		 6 7 1 4 8 1 7 8 0 3 9 0 9 8 0 6 9 0 10 7 1 5 11 0 10 11 0 11 8 0 2 4 0 1 12 1 6 13 0
		 12 13 0 7 14 0 13 14 1 10 15 0 15 14 0 1 16 0 12 17 0 16 17 0 0 16 0 13 18 0 14 19 0
		 18 19 0;
	setAttr -s 13 -ch 52 ".fc[0:12]" -type "polyFaces" 
		f 4 12 11 -10 -8
		mu 0 4 7 10 9 8
		f 4 9 -17 -16 13
		mu 0 4 11 14 13 12
		f 4 8 -12 -11 3
		mu 0 4 2 9 10 3
		f 4 10 -13 -7 2
		mu 0 4 3 10 7 0
		f 4 14 16 -9 -6
		mu 0 4 5 13 14 6
		f 4 4 5 -18 -1
		mu 0 4 4 5 6 1
		f 4 17 -4 -3 1
		mu 0 4 1 2 3 0
		f 4 6 19 -21 -19
		mu 0 4 0 7 16 15
		f 4 7 21 -23 -20
		mu 0 4 7 8 17 16
		f 4 -14 23 24 -22
		mu 0 4 11 12 19 18
		f 4 18 26 -28 -26
		mu 0 4 0 20 21 22
		f 4 0 -2 25 -29
		mu 0 4 4 1 0 22
		f 4 22 30 -32 -30
		mu 0 4 23 24 25 26;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 2 
		0 0 
		1 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface38" -p "group11";
	rename -uid "8FDF988C-417F-28E5-696C-968B1B48E6BF";
	setAttr ".t" -type "double3" 162.58837414553079 -137.55924374311422 -0.69020500201631307 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape38" -p "polySurface38";
	rename -uid "C1167E75-4AB0-58FC-E2A8-C098AD59655C";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface12" -p "group11";
	rename -uid "1D9ECCF6-4595-8EE9-999C-08BEB73A8C5A";
	setAttr ".t" -type "double3" 434.9999899529659 -0.049616158729691051 0 ;
createNode mesh -n "polySurfaceShape19" -p "polySurface12";
	rename -uid "F7AA0F2B-48F3-15D6-561A-4C8208CF0106";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:4]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "e[7]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "e[8]";
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 1 "e[0:1]";
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 2 "e[2]" "e[12]";
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 3 "e[0:2]" "e[7:8]" "e[12]";
	setAttr ".pv" -type "double2" 0.21543906582519412 0.76400899887084961 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 11 ".uvst[0].uvsp[0:10]" -type "float2" 0 0.5 0.42036906
		 0.528018 0.42044774 1.0052523613 0 1 0 0 0.42044774 0.0052523166 0.40625 -0.09375
		 1.125 0.125 1 1 0 0.5 0.42036211 0.52803242;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 9 ".vt[0:8]"  -208.5 0 -56 208.49998474 0 -56 208.5 0 -496
		 -208.5 0 -496 -208.5 0 496 208.5 0 496 208.5 0 -56 312.5 0 -56 312.5 0 -496;
	setAttr -s 13 ".ed[0:12]"  4 0 0 0 3 0 6 2 1 0 1 1 1 6 1 5 1 1 1 2 1
		 3 2 0 4 5 0 6 7 0 7 8 0 2 8 0 5 6 0;
	setAttr -s 5 -ch 18 ".fc[0:4]" -type "polyFaces" 
		f 4 3 6 -8 -2
		mu 0 4 0 1 2 3
		f 4 8 5 -4 -1
		mu 0 4 4 5 1 0
		f 4 -3 9 10 -12
		mu 0 4 6 7 8 9
		f 3 -6 12 -5
		mu 0 3 1 5 10
		f 3 -7 4 2
		mu 0 3 2 1 10;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface51" -p "group11";
	rename -uid "BC0CE52A-4CCB-A506-50AE-95AD5701E15B";
	setAttr ".t" -type "double3" -9.7875213623046875 0 96.831124407873915 ;
	setAttr ".s" -type "double3" 1 1 0.95248544414508485 ;
	setAttr ".rp" -type "double3" 229.78752136230469 100.00025177001952 318.13013834445832 ;
	setAttr ".sp" -type "double3" 229.78752136230469 100.00025177001952 334 ;
	setAttr ".spt" -type "double3" 0 0 -15.86986165554168 ;
createNode mesh -n "polySurfaceShape51" -p "polySurface51";
	rename -uid "D63F54BF-4109-7B92-AA7D-C9A745C849F3";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  3.2875366 -1.8651747e-14 
		820 3.2875366 -2.8421709e-14 820 3.2875366 -2.8421709e-14 670 3.2875366 -1.8651747e-14 
		670 0 0 0 0 0 0 0 0 0 0 0 0;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 3 -3 -2
		mu 0 4 0 1 3 2;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape86" -p "polySurface51";
	rename -uid "9D9101BE-4CB8-5F62-79BB-55B71FD035C2";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape87" -p "polySurface51";
	rename -uid "795E4543-418F-FD13-2B56-8B86C5EF9009";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 1 0.5 0 0.5 0
		 0.5 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".vt[0:7]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331;
	setAttr -s 12 ".ed[0:11]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0;
	setAttr -s 4 -ch 16 ".fc[0:3]" -type "polyFaces" 
		f 4 3 5 -7 -5
		mu 0 4 0 1 2 3
		f 4 2 7 -9 -6
		mu 0 4 1 4 5 2
		f 4 0 9 -11 -8
		mu 0 4 4 6 7 5
		f 4 -2 4 11 -10
		mu 0 4 6 0 3 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface26" -p "group11";
	rename -uid "7DD7158A-4F12-9456-0D57-8CBA3E450C2F";
	setAttr ".t" -type "double3" 24.64209071991047 -21.861231337396291 -0.076684510622129665 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.400022837621691 -7.400022837621691 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
createNode mesh -n "polySurfaceShape61" -p "polySurface26";
	rename -uid "3EA92110-4D3B-757A-E65A-01B5258CC143";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface52" -p "group11";
	rename -uid "A3579D89-4F0C-6EF1-020D-23A330CC5961";
	setAttr ".rp" -type "double3" 434.9999899529659 0 0 ;
	setAttr ".sp" -type "double3" 434.9999899529659 0 0 ;
createNode mesh -n "polySurfaceShape52" -p "polySurface52";
	rename -uid "2ACF4365-46EC-9DB9-D449-CAAEB3572A97";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:109]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.29166662693023682 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 142 ".uvst[0].uvsp[0:141]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0 0 0.60541677 0.5 0.60541677
		 0.58333325 0.60541677 0 0.64458334 0.5 0.64458334 0.58333325 0.64458334 0.5 0.25
		 0.58333325 0.25 0 0.60541677 0.5 0.60541677 0.5 0.5 0 0.5 0.5 0.60541677 0.58333325
		 0.60541677 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.58333325 0.25 0.58333325 0 0 0.64458334
		 0.5 0.64458334 0.5 0.60541677 0 0.60541677 0.5 0.64458334 0.58333325 0.64458334 0.58333325
		 0.60541677 0.5 0.60541677 0.5 0.75 0.5 0.64458334 0 0.64458334 0 0.75 0.58333325
		 0.75 0.58333325 0.64458334 0.5 0.64458334 0.5 0.75 0.58333325 0.25 0.5 0.25 0.5 0.5
		 0.58333325 0.5 0 0.60541677 0.5 0.60541677 0.5 0.60541677 0 0.60541677 0.5 0.5 0.5
		 0.5 0 0.5 0 0.5 0.58333325 0.60541677 0.58333325 0.60541677 0.5 0.60541677 0.58333325
		 0.5 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.5 0.25 0.5 0 0.58333325 0.25 0.58333325
		 0.25 0.58333325 0 0.58333325 0 0 0.64458334 0.5 0.64458334 0.5 0.64458334 0 0.64458334
		 0.5 0.60541677 0 0.60541677 0.58333325 0.64458334 0.58333325 0.64458334 0.5 0.64458334
		 0.58333325 0.60541677 0.5 0.60541677 0.5 0.75 0.5 0.64458334 0.5 0.75 0 0.64458334
		 0 0.75 0 0.75 0.58333325 0.75 0.58333325 0.64458334 0.58333325 0.75 0.5 0.64458334
		 0.5 0.75 0.5 0.25 0.58333325 0.25 0.5 0.5 0.58333325 0.5 0.5 0.60541677 0 0.60541677
		 0.5 0.5 0.5 0.5 0 0.5 0 0.5 0 0.60541677 0.58333325 0.60541677 0.5 0.60541677 0.58333325
		 0.60541677 0.58333325 0.5 0.58333325 0.5 0.5 0.5 0.5 0 0.5 0.25 0.5 0.25 0.5 0 0.58333325
		 0.25 0.58333325 0.25 0.58333325 0 0.58333325 0 0.5 0.64458334 0 0.64458334 0.5 0.60541677
		 0 0.60541677 0 0.64458334 0.58333325 0.64458334 0.5 0.64458334 0.58333325 0.64458334
		 0.58333325 0.60541677 0.5 0.60541677 0.5 0.64458334 0.5 0.75 0 0.64458334 0 0.75
		 0 0.75 0.5 0.75 0.58333325 0.75 0.58333325 0.64458334 0.58333325 0.75 0.5 0.64458334
		 0.5 0.75 0.5 0.25 0.58333325 0.25 0.5 0.5 0.58333325 0.5;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 96 ".vt[0:95]"  226.5 200.00050354004 -496 226.5 200.00050354004 -326
		 226.5 1.0325074e-14 -326 226.5 400 -496 226.5 400 -326 226.50001526 400 -176 226.50001526 200.00050354004 -176
		 226.50001526 1.8651747e-14 -176 226.5 228.00044250488 -496 226.5 228.0004119873 -326
		 226.5 228.0004119873 -176 226.50001526 258.00067138672 -496 226.5 258.00061035156 -326
		 226.50001526 258.00061035156 -176 226.5 168.00016784668 -326 226.50001526 168.00016784668 -176
		 226.5 226.00044250488 -494 226.5 226.0004119873 -328 226.5 202.00050354004 -328 226.5 202.00050354004 -494
		 226.5 226.0004119873 -324 226.5 226.0004119873 -178 226.50001526 202.00050354004 -178
		 226.5 202.00050354004 -324 226.5 166.00016784668 -324 226.5 1.99999988 -324 226.50001526 166.00016784668 -178
		 226.50001526 1.99999988 -178 226.50001526 256.00067138672 -494 226.5 256.00061035156 -328
		 226.5 230.0004119873 -328 226.5 230.00044250488 -494 226.5 256.00061035156 -324 226.50001526 256.00061035156 -178
		 226.5 230.0004119873 -178 226.5 230.0004119873 -324 226.5 398 -328 226.5 260.00061035156 -328
		 226.50001526 260.00067138672 -494 226.5 398 -494 226.50001526 398 -178 226.50001526 260.00061035156 -178
		 226.5 260.00061035156 -324 226.5 398 -324 226.5 170.00016784668 -324 226.50001526 170.00016784668 -178
		 226.5 198.00050354004 -324 226.50001526 198.00050354004 -178 222.5 228.00044250488 -496
		 222.5 228.0004119873 -326 222.5 226.0004119873 -328 222.5 226.00044250488 -494 222.5 200.00050354004 -326
		 222.5 202.00050354004 -328 222.5 200.00050354004 -496 222.5 202.00050354004 -494
		 222.5 228.0004119873 -176 222.5 226.0004119873 -178 222.5 226.0004119873 -324 222.50001526 200.00050354004 -176
		 222.50001526 202.00050354004 -178 222.5 202.00050354004 -324 222.5 168.00016784668 -326
		 222.5 1.0325074e-14 -326 222.5 166.00016784668 -324 222.5 2.000000238419 -324 222.50001526 168.00016784668 -176
		 222.50001526 166.00016784668 -178 222.50001526 4.1239977e-07 -176 222.50001526 1.99999988 -178
		 222.50001526 258.00067138672 -496 222.5 258.00061035156 -326 222.5 256.00061035156 -328
		 222.50001526 256.00067138672 -494 222.5 230.0004119873 -328 222.5 230.00044250488 -494
		 222.50001526 258.00061035156 -176 222.50001526 256.00061035156 -178 222.5 256.00061035156 -324
		 222.5 230.0004119873 -178 222.5 230.0004119873 -324 222.5 400 -326 222.5 260.00061035156 -328
		 222.5 398 -328 222.50001526 260.00067138672 -494 222.5 400 -496 222.5 398 -494 222.50001526 400 -176
		 222.50001526 260.00061035156 -178 222.50001526 398 -178 222.5 260.00061035156 -324
		 222.5 398 -324 222.5 170.00016784668 -324 222.50001526 170.00016784668 -178 222.5 198.00050354004 -324
		 222.50001526 198.00050354004 -178;
	setAttr -s 220 ".ed";
	setAttr ".ed[0:165]"  0 8 0 0 1 0 1 6 1 2 7 0 4 12 1 1 14 0 3 4 0 5 13 0
		 4 5 0 6 15 0 8 11 0 9 1 1 10 6 0 8 9 1 9 10 1 11 3 0 12 9 1 13 10 0 11 12 1 12 13 1
		 14 2 0 15 7 0 14 15 1 8 16 0 9 17 0 16 17 0 1 18 0 17 18 0 0 19 0 19 18 0 19 16 0
		 9 20 0 10 21 0 20 21 0 6 22 0 21 22 0 1 23 0 23 22 0 20 23 0 14 24 1 2 25 1 24 25 0
		 15 26 1 24 26 0 7 27 1 26 27 0 25 27 0 11 28 1 12 29 1 28 29 0 9 30 1 29 30 0 8 31 1
		 31 30 0 31 28 0 12 32 1 13 33 1 32 33 0 10 34 1 33 34 0 9 35 1 35 34 0 32 35 0 4 36 1
		 12 37 1 36 37 0 11 38 1 38 37 0 3 39 1 38 39 0 39 36 0 5 40 1 13 41 1 40 41 0 12 42 1
		 42 41 0 4 43 1 43 42 0 43 40 0 14 44 1 15 45 1 44 45 0 1 46 1 46 44 0 6 47 1 46 47 0
		 47 45 0 8 48 1 48 49 1 17 50 0 49 50 0 16 51 0 51 50 0 48 51 0 1 52 0 49 52 1 18 53 0
		 52 53 0 50 53 0 0 54 0 54 52 0 19 55 0 54 55 0 55 53 0 54 48 0 55 51 0 10 56 1 49 56 1
		 21 57 0 56 57 0 20 58 0 58 57 0 49 58 0 6 59 1 56 59 0 22 60 0 59 60 0 57 60 0 52 59 1
		 23 61 0 52 61 0 61 60 0 58 61 0 14 62 1 2 63 0 62 63 0 24 64 0 62 64 1 25 65 0 64 65 0
		 63 65 1 15 66 1 62 66 1 26 67 0 66 67 1 64 67 0 7 68 0 66 68 0 27 69 0 68 69 1 67 69 0
		 63 68 0 65 69 0 11 70 1 70 71 1 29 72 0 71 72 1 28 73 0 73 72 0 70 73 1 71 49 1 30 74 0
		 49 74 1 72 74 0 31 75 0 48 75 1 75 74 0 48 70 0 75 73 0 13 76 1 71 76 1 33 77 0 76 77 1
		 32 78 0 78 77 0 71 78 1;
	setAttr ".ed[166:219]" 76 56 0 34 79 0 56 79 1 77 79 0 35 80 0 49 80 1 80 79 0
		 78 80 0 4 81 1 81 71 1 37 82 0 71 82 1 36 83 0 83 82 0 81 83 1 38 84 0 70 84 1 84 82 0
		 3 85 0 70 85 0 39 86 0 85 86 1 84 86 0 85 81 0 86 83 0 5 87 0 87 76 0 41 88 0 76 88 1
		 40 89 0 89 88 0 87 89 1 42 90 0 71 90 1 90 88 0 43 91 0 81 91 1 91 90 0 81 87 0 91 89 0
		 44 92 0 62 92 1 45 93 0 92 93 0 66 93 1 52 62 0 46 94 0 52 94 1 94 92 0 47 95 0 59 95 1
		 94 95 0 59 66 0 95 93 0;
	setAttr -s 110 -ch 440 ".fc[0:109]" -type "polyFaces" 
		f 4 93 92 -91 -89
		mu 0 4 102 97 96 9
		f 4 90 98 -98 -96
		mu 0 4 9 96 98 99
		f 4 97 -104 -103 100
		mu 0 4 99 98 101 100
		f 4 102 105 -94 -105
		mu 0 4 100 101 97 102
		f 4 112 111 -110 -108
		mu 0 4 9 104 103 105
		f 4 109 117 -117 -115
		mu 0 4 105 103 107 106
		f 4 116 -122 -121 118
		mu 0 4 106 107 108 99
		f 4 120 -123 -113 95
		mu 0 4 99 108 104 9
		f 4 130 -130 -128 125
		mu 0 4 109 112 111 110
		f 4 127 135 -135 -133
		mu 0 4 110 111 113 114
		f 4 134 140 -140 -138
		mu 0 4 114 113 116 115
		f 4 139 -143 -131 141
		mu 0 4 115 116 112 109
		f 4 149 148 -147 -145
		mu 0 4 121 118 117 12
		f 4 146 153 -153 -151
		mu 0 4 12 117 119 9
		f 4 152 -157 -156 88
		mu 0 4 9 119 120 102
		f 4 155 158 -150 -158
		mu 0 4 102 120 118 121
		f 4 165 164 -163 -161
		mu 0 4 12 123 122 124
		f 4 162 169 -169 -167
		mu 0 4 124 122 125 105
		f 4 168 -173 -172 107
		mu 0 4 105 125 126 9
		f 4 171 -174 -166 150
		mu 0 4 9 126 123 12
		f 4 180 179 -178 -176
		mu 0 4 132 128 127 12
		f 4 177 -184 -183 144
		mu 0 4 12 127 129 121
		f 4 182 188 -188 -186
		mu 0 4 121 129 131 130
		f 4 187 190 -181 -190
		mu 0 4 130 131 128 132
		f 4 197 196 -195 -193
		mu 0 4 133 135 134 124
		f 4 194 -201 -200 160
		mu 0 4 124 134 136 12
		f 4 199 -204 -203 175
		mu 0 4 12 136 137 132
		f 4 202 205 -198 -205
		mu 0 4 132 137 135 133
		f 4 210 -210 -208 132
		mu 0 4 114 139 138 110
		f 4 207 -215 -214 211
		mu 0 4 110 138 140 99
		f 4 213 217 -217 -119
		mu 0 4 99 140 141 106
		f 4 216 219 -211 -219
		mu 0 4 106 141 139 114
		f 4 13 24 -26 -24
		mu 0 4 48 49 50 51
		f 4 11 26 -28 -25
		mu 0 4 49 52 53 50
		f 4 -2 28 29 -27
		mu 0 4 52 54 55 53
		f 4 0 23 -31 -29
		mu 0 4 54 48 51 55
		f 4 14 32 -34 -32
		mu 0 4 49 56 57 58
		f 4 12 34 -36 -33
		mu 0 4 56 59 60 57
		f 4 -3 36 37 -35
		mu 0 4 59 52 61 60
		f 4 -12 31 38 -37
		mu 0 4 52 49 58 61
		f 4 -21 39 41 -41
		mu 0 4 62 63 64 65
		f 4 22 42 -44 -40
		mu 0 4 63 66 67 64
		f 4 21 44 -46 -43
		mu 0 4 66 68 69 67
		f 4 -4 40 46 -45
		mu 0 4 68 62 65 69
		f 4 18 48 -50 -48
		mu 0 4 70 71 72 73
		f 4 16 50 -52 -49
		mu 0 4 71 49 74 72
		f 4 -14 52 53 -51
		mu 0 4 49 48 75 74
		f 4 10 47 -55 -53
		mu 0 4 48 70 73 75
		f 4 19 56 -58 -56
		mu 0 4 71 76 77 78
		f 4 17 58 -60 -57
		mu 0 4 76 56 79 77
		f 4 -15 60 61 -59
		mu 0 4 56 49 80 79
		f 4 -17 55 62 -61
		mu 0 4 49 71 78 80
		f 4 4 64 -66 -64
		mu 0 4 81 71 82 83
		f 4 -19 66 67 -65
		mu 0 4 71 70 84 82
		f 4 15 68 -70 -67
		mu 0 4 70 85 86 84
		f 4 6 63 -71 -69
		mu 0 4 85 81 83 86
		f 4 7 72 -74 -72
		mu 0 4 87 76 88 89
		f 4 -20 74 75 -73
		mu 0 4 76 71 90 88
		f 4 -5 76 77 -75
		mu 0 4 71 81 91 90
		f 4 8 71 -79 -77
		mu 0 4 81 87 89 91
		f 4 -23 79 81 -81
		mu 0 4 66 63 92 93
		f 4 -6 82 83 -80
		mu 0 4 63 52 94 92
		f 4 2 84 -86 -83
		mu 0 4 52 59 95 94
		f 4 9 80 -87 -85
		mu 0 4 59 66 93 95
		f 4 89 -93 -92 25
		mu 0 4 17 96 97 16
		f 4 96 -99 -90 27
		mu 0 4 18 98 96 17
		f 4 94 -101 -100 1
		mu 0 4 1 99 100 2
		f 4 101 103 -97 -30
		mu 0 4 19 101 98 18
		f 4 99 104 -88 -1
		mu 0 4 2 100 102 8
		f 4 91 -106 -102 30
		mu 0 4 16 97 101 19
		f 4 108 -112 -111 33
		mu 0 4 21 103 104 20
		f 4 106 114 -114 -13
		mu 0 4 10 105 106 5
		f 4 115 -118 -109 35
		mu 0 4 22 107 103 21
		f 4 119 121 -116 -38
		mu 0 4 23 108 107 22
		f 4 110 122 -120 -39
		mu 0 4 20 104 108 23
		f 4 124 -126 -124 20
		mu 0 4 6 109 110 14
		f 4 126 129 -129 -42
		mu 0 4 25 111 112 24
		f 4 133 -136 -127 43
		mu 0 4 26 113 111 25
		f 4 131 137 -137 -22
		mu 0 4 15 114 115 7
		f 4 138 -141 -134 45
		mu 0 4 27 116 113 26
		f 4 136 -142 -125 3
		mu 0 4 7 115 109 6
		f 4 128 142 -139 -47
		mu 0 4 24 112 116 27
		f 4 145 -149 -148 49
		mu 0 4 29 117 118 28
		f 4 151 -154 -146 51
		mu 0 4 30 119 117 29
		f 4 154 156 -152 -54
		mu 0 4 31 120 119 30
		f 4 87 157 -144 -11
		mu 0 4 8 102 121 11
		f 4 147 -159 -155 54
		mu 0 4 28 118 120 31
		f 4 161 -165 -164 57
		mu 0 4 33 122 123 32
		f 4 159 166 -107 -18
		mu 0 4 13 124 105 10
		f 4 167 -170 -162 59
		mu 0 4 34 125 122 33
		f 4 170 172 -168 -62
		mu 0 4 35 126 125 34
		f 4 163 173 -171 -63
		mu 0 4 32 123 126 35
		f 4 176 -180 -179 65
		mu 0 4 37 127 128 36
		f 4 181 183 -177 -68
		mu 0 4 38 129 127 37
		f 4 143 185 -185 -16
		mu 0 4 11 121 130 3
		f 4 186 -189 -182 69
		mu 0 4 39 131 129 38
		f 4 184 189 -175 -7
		mu 0 4 3 130 132 0
		f 4 178 -191 -187 70
		mu 0 4 36 128 131 39
		f 4 191 192 -160 -8
		mu 0 4 4 133 124 13
		f 4 193 -197 -196 73
		mu 0 4 41 134 135 40
		f 4 198 200 -194 -76
		mu 0 4 42 136 134 41
		f 4 201 203 -199 -78
		mu 0 4 43 137 136 42
		f 4 174 204 -192 -9
		mu 0 4 0 132 133 4
		f 4 195 -206 -202 78
		mu 0 4 40 135 137 43
		f 4 206 209 -209 -82
		mu 0 4 45 138 139 44
		f 4 123 -212 -95 5
		mu 0 4 14 110 99 1
		f 4 212 214 -207 -84
		mu 0 4 46 140 138 45
		f 4 215 -218 -213 85
		mu 0 4 47 141 140 46
		f 4 113 218 -132 -10
		mu 0 4 5 106 114 15
		f 4 208 -220 -216 86
		mu 0 4 44 139 141 47;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface36" -p "group11";
	rename -uid "DB8DBF90-4617-AB36-1809-B7AB411ABC87";
	setAttr ".t" -type "double3" 197.05421419553113 -166.46635954684322 -0.84349292394276176 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376218047 -7.4000228376218047 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape36" -p "polySurface36";
	rename -uid "C9D5BB76-481E-A053-9FB7-ADB6983B125B";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface53" -p "group11";
	rename -uid "13BD24AB-4919-1E90-4DA7-278788DA296F";
	setAttr ".t" -type "double3" -9.7875213623046875 0 15.869861655541683 ;
	setAttr ".s" -type "double3" 1 1 0.95248544414508485 ;
	setAttr ".rp" -type "double3" 232.28752136230469 100.00025177001952 358.61076972062443 ;
	setAttr ".sp" -type "double3" 232.28752136230469 100.00025177001952 376.5 ;
	setAttr ".spt" -type "double3" 0 0 -17.889230279375575 ;
createNode mesh -n "polySurfaceShape53" -p "polySurface53";
	rename -uid "94D8C8BD-4238-C8E1-4AE6-F9B2406BE617";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".pt[0:15]" -type "float3"  5.7875214 -1.8651747e-14 
		660 5.7875214 -2.8421709e-14 660 5.7875214 -1.8651747e-14 830 5.7875214 -2.8421709e-14 
		830 5.7875214 -1.8651747e-14 820 5.7875214 -2.8421709e-14 820 5.7875214 -2.8421709e-14 
		670 5.7875214 -1.8651747e-14 670 5.7875214 -1.8651747e-14 830 5.7875214 -2.8421709e-14 
		830 5.7875214 -2.8421709e-14 820 5.7875214 -1.8651747e-14 820 5.7875214 -2.8421709e-14 
		660 5.7875214 -2.8421709e-14 670 5.7875214 -1.8651747e-14 660 5.7875214 -1.8651747e-14 
		670;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 14 16 -19 -20
		mu 0 4 16 17 18 19
		f 4 21 23 -25 -17
		mu 0 4 17 20 21 18
		f 4 26 28 -30 -24
		mu 0 4 20 22 23 21
		f 4 -31 19 31 -29
		mu 0 4 22 16 19 23
		f 4 4 6 -6 -4
		mu 0 4 8 11 10 9
		f 4 5 8 -8 -3
		mu 0 4 9 10 13 12
		f 4 7 10 -10 -1
		mu 0 4 12 13 15 14
		f 4 9 -12 -5 1
		mu 0 4 14 15 11 8
		f 4 3 13 -15 -13
		mu 0 4 2 3 17 16
		f 4 -7 17 18 -16
		mu 0 4 5 4 19 18
		f 4 2 20 -22 -14
		mu 0 4 3 0 20 17
		f 4 -9 15 24 -23
		mu 0 4 6 5 18 21
		f 4 0 25 -27 -21
		mu 0 4 0 1 22 20
		f 4 -11 22 29 -28
		mu 0 4 7 6 21 23
		f 4 -2 12 30 -26
		mu 0 4 1 2 16 22
		f 4 11 27 -32 -18
		mu 0 4 4 7 23 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape88" -p "polySurface53";
	rename -uid "1A7CE505-4019-B935-44F4-9ABE462428C2";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface39" -p "group11";
	rename -uid "200F00D6-4454-78C8-316E-09BFABE250A9";
	setAttr ".t" -type "double3" 179.81217683082048 -152.00515476927666 -0.7668084133206321 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376219184 -7.4000228376215773 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape39" -p "polySurface39";
	rename -uid "7DC1F429-49D5-3D45-91B7-FDA2D35108D4";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape69" -p "polySurface39";
	rename -uid "729C41E0-4249-5D51-64E8-3BAC2707A50D";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface6" -p "group11";
	rename -uid "C2886593-4EB7-ACF4-AE83-F8BA6B7D7A62";
	setAttr ".t" -type "double3" 434.9999899529659 0 0 ;
createNode mesh -n "polySurfaceShape9" -p "polySurface6";
	rename -uid "2C277C3F-4D10-66CA-E267-9C80A95331B8";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:29]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 48 ".uvst[0].uvsp[0:47]" -type "float2" 0.5 1 0.5 0.75 0
		 0.75 0 1 0.58333325 1 0.58333325 0.75 1 0.75 0.75 0.75 0.75 1 1 1 0.66666663 1 0.66666663
		 0.75 0.66666663 0.5 0.58333325 0.5 0.58333325 0 0.66666663 0 0.5 1 0.5 0.75 0 0.75
		 0 1 0.58333325 1 0.58333325 0.75 1 0.75 0.75 0.75 0.75 1 1 1 0.66666663 1 0.66666663
		 0.75 0.66666663 0.5 0.58333325 0.5 0.58333325 0 0.66666663 0 0.5 0.75 0 0.75 0 1
		 0.5 1 0.58333325 0.75 0.58333325 1 1 0.75 0.75 0.75 0.75 1 1 1 0.66666663 1 0.66666663
		 0.75 0.66666663 0.5 0.58333325 0.5 0.58333325 0 0.66666663 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".pt[0:15]" -type "float3"  10.000003 0 0 10.000003 0 
		0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 
		0 0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 0 0 10.000003 
		0 0 10.000003 0 0 10.000003 0 0;
	setAttr -s 32 ".vt[0:31]"  -208.5 438 -496 -208.5 438 496 -208.5 400 -496
		 -208.5 400 496 -208.5 438 -326 -208.5 400 -326 -208.5 438 334 -208.5 400 334 -208.49998474 438 -176
		 -208.49998474 400 -176 -208.49998474 240 -176 -208.49998474 2.8421709e-14 -176 -208.5 438 172
		 -208.5 400 172 -208.5 240 172 -208.5 2.8421709e-14 172 -218.5 438 -326 -218.5 400 -326
		 -218.5 400 -496 -218.5 438 -496 -218.49998474 438 -176 -218.49998474 400 -176 -218.5 400 334
		 -218.5 400 496 -218.5 438 334 -218.5 438 496 -218.5 438 172 -218.5 400 172 -218.5 240 172
		 -218.49998474 240 -176 -218.49998474 2.8421709e-14 -176 -218.5 2.8421709e-14 172;
	setAttr -s 60 ".ed[0:59]"  0 4 0 2 0 0 3 1 0 2 5 0 4 8 0 5 9 0 4 5 1
		 6 1 0 7 3 0 6 7 1 8 12 0 9 13 1 10 14 1 11 15 0 8 9 1 9 10 0 10 11 0 12 6 0 13 7 0
		 12 13 1 13 14 0 14 15 0 4 16 1 5 17 1 16 17 1 2 18 0 18 17 0 0 19 0 18 19 0 19 16 0
		 8 20 1 9 21 0 20 21 1 17 21 0 16 20 0 7 22 1 3 23 0 22 23 0 6 24 1 24 22 1 1 25 0
		 24 25 0 23 25 0 12 26 1 13 27 0 26 27 1 21 27 1 20 26 0 14 28 1 27 28 0 10 29 1 29 28 1
		 21 29 0 11 30 0 29 30 0 15 31 0 28 31 0 30 31 0 27 22 0 26 24 0;
	setAttr -s 30 -ch 120 ".fc[0:29]" -type "polyFaces" 
		f 4 -30 -29 26 -25
		mu 0 4 35 34 33 32
		f 4 -35 24 33 -33
		mu 0 4 37 35 32 36
		f 4 42 -42 39 37
		mu 0 4 38 41 40 39
		f 4 -48 32 46 -46
		mu 0 4 42 37 36 43
		f 4 -47 52 51 -50
		mu 0 4 43 36 45 44
		f 4 57 -57 -52 54
		mu 0 4 46 47 44 45
		f 4 -60 45 58 -40
		mu 0 4 40 42 43 39
		f 4 6 -4 1 0
		mu 0 4 16 17 18 19
		f 4 14 -6 -7 4
		mu 0 4 20 21 17 16
		f 4 -9 -10 7 -3
		mu 0 4 22 23 24 25
		f 4 19 -12 -15 10
		mu 0 4 26 27 21 20
		f 4 20 -13 -16 11
		mu 0 4 27 28 29 21
		f 4 -17 12 21 -14
		mu 0 4 30 29 28 31
		f 4 9 -19 -20 17
		mu 0 4 24 23 27 26
		f 4 23 -27 -26 3
		mu 0 4 1 32 33 2
		f 4 25 28 -28 -2
		mu 0 4 2 33 34 3
		f 4 27 29 -23 -1
		mu 0 4 3 34 35 0
		f 4 31 -34 -24 5
		mu 0 4 5 36 32 1
		f 4 22 34 -31 -5
		mu 0 4 0 35 37 4
		f 4 36 -38 -36 8
		mu 0 4 6 38 39 7
		f 4 38 41 -41 -8
		mu 0 4 8 40 41 9
		f 4 40 -43 -37 2
		mu 0 4 9 41 38 6
		f 4 30 47 -44 -11
		mu 0 4 4 37 42 10
		f 4 44 49 -49 -21
		mu 0 4 11 43 44 12
		f 4 50 -53 -32 15
		mu 0 4 13 45 36 5
		f 4 53 -55 -51 16
		mu 0 4 14 46 45 13
		f 4 48 56 -56 -22
		mu 0 4 12 44 47 15
		f 4 55 -58 -54 13
		mu 0 4 15 47 46 14
		f 4 35 -59 -45 18
		mu 0 4 7 39 43 11
		f 4 43 59 -39 -18
		mu 0 4 10 42 40 8;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface21" -p "group11";
	rename -uid "98F1EE81-4C26-CED5-0068-189107A89871";
	setAttr ".t" -type "double3" -9.7875213623046875 0 0 ;
	setAttr ".rp" -type "double3" 232.28752136230469 199.99999999999997 332 ;
	setAttr ".sp" -type "double3" 232.28752136230469 199.99999999999997 332 ;
createNode mesh -n "polySurfaceShape21" -p "polySurface21";
	rename -uid "204524B2-4351-3514-08C7-67B92F00B673";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.58333325386047363 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  5.7875137 -2.8421709e-14 
		988 5.7875137 -2.8421709e-14 658 5.7875137 -1.8651747e-14 658 5.7875137 0 988 5.7875137 
		0 658 5.7875137 0 350 5.7875137 -2.8421709e-14 350 5.7875137 -1.8651747e-14 350;
	setAttr -s 8 ".vt[0:7]"  226.5 200.00050354004 -496 226.5 200.00050354004 -326
		 226.5 1.0325074e-14 -326 226.5 400 -496 226.5 400 -326 226.50001526 400 -176 226.50001526 200.00050354004 -176
		 226.50001526 1.8651747e-14 -176;
	setAttr -s 10 ".ed[0:9]"  0 1 0 1 6 1 2 7 0 1 2 0 3 4 0 4 5 0 5 6 0
		 0 3 0 4 1 1 6 7 0;
	setAttr -s 3 -ch 12 ".fc[0:2]" -type "polyFaces" 
		f 4 -5 -8 0 -9
		mu 0 4 0 3 2 1
		f 4 -6 8 1 -7
		mu 0 4 4 0 1 5
		f 4 -2 3 2 -10
		mu 0 4 5 1 6 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape40" -p "polySurface21";
	rename -uid "A413020A-4513-017B-BD2E-779895E472F5";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:2]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 3 "e[0]" "e[4]" "e[7]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.29166662693023682 0.625 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  435 -39.999496 0 435 -39.999496 
		0 435 0 0 435 0 0 435 0 0 435 0 0 435 -39.999496 0 435 0 0;
	setAttr -s 8 ".vt[0:7]"  -208.5 240 -496 -208.5 240 -326 -208.5 1.0325074e-14 -326
		 -208.5 400 -496 -208.5 400 -326 -208.49998474 400 -176 -208.49998474 240 -176 -208.49998474 1.8651747e-14 -176;
	setAttr -s 10 ".ed[0:9]"  0 3 0 0 1 0 1 6 1 2 7 0 4 1 1 1 2 0 3 4 0
		 5 6 0 4 5 0 6 7 0;
	setAttr -s 3 -ch 12 ".fc[0:2]" -type "polyFaces" 
		f 4 4 -2 0 6
		mu 0 4 0 1 2 3
		f 4 7 -3 -5 8
		mu 0 4 4 5 1 0
		f 4 -6 2 9 -4
		mu 0 4 6 1 5 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pCube1_1M_Ref2" -p "group11";
	rename -uid "60BCF56A-4215-7D56-D3E3-128F37BD2DA4";
	setAttr ".t" -type "double3" 524.49996958195038 0 13.749996185302727 ;
	setAttr ".s" -type "double3" 2.38 2.1 0.185 ;
	setAttr ".rp" -type "double3" 119.00003041804966 0 -9.2499999999999964 ;
	setAttr ".sp" -type "double3" 50.000012780689815 0 -50.00000000001711 ;
	setAttr ".spt" -type "double3" 69.000017637359846 0 40.75000000001711 ;
createNode mesh -n "pCube1_1M_Ref2Shape" -p "pCube1_1M_Ref2";
	rename -uid "02D2AA9F-48C2-75AA-1667-FAAFAA11EACD";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "f[2]";
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[3]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "f[4]";
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[1]";
	setAttr ".pv" -type "double2" 0.75 0.125 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 12 ".uvst[0].uvsp[0:11]" -type "float2" 0.375 0 0.625 0 0.375
		 0.25 0.625 0.25 0.375 0.5 0.625 0.5 0.375 0.75 0.625 0.75 0.375 1 0.625 1 0.125 0
		 0.125 0.25;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".vt[0:7]"  -50 0 50 50 0 50 -50 100 50 50 100 50 -50 100 -50
		 50 100 -50 -50 0 -50 50 0 -50;
	setAttr -s 12 ".ed[0:11]"  0 1 0 2 3 0 4 5 0 6 7 0 0 2 0 1 3 0 2 4 0
		 3 5 0 4 6 0 5 7 0 6 0 0 7 1 0;
	setAttr -s 5 -ch 20 ".fc[0:4]" -type "polyFaces" 
		f 4 0 5 -2 -5
		mu 0 4 0 1 3 2
		f 4 1 7 -3 -7
		mu 0 4 2 3 5 4
		f 4 2 9 -4 -9
		mu 0 4 4 5 7 6
		f 4 3 11 -1 -11
		mu 0 4 6 7 9 8
		f 4 10 4 6 8
		mu 0 4 10 0 2 11;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface54" -p "group11";
	rename -uid "0C045494-4710-3168-EF2F-80A7D430532D";
	setAttr ".t" -type "double3" -4.0000076293945312 0 0 ;
	setAttr ".rp" -type "double3" 226.50000762939453 200 -336 ;
	setAttr ".sp" -type "double3" 226.50000762939453 200 -336 ;
createNode mesh -n "polySurfaceShape54" -p "polySurface54";
	rename -uid "C6861D34-46B3-308D-FF66-BCB872C02A8C";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.54166662693023682 0.25 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".vt[0:7]"  226.5 200.00050354004 -496 226.5 200.00050354004 -326
		 226.5 1.0325074e-14 -326 226.5 400 -496 226.5 400 -326 226.50001526 400 -176 226.50001526 200.00050354004 -176
		 226.50001526 1.8651747e-14 -176;
	setAttr -s 10 ".ed[0:9]"  0 1 0 1 6 1 2 7 0 1 2 0 3 4 0 4 5 0 5 6 0
		 0 3 0 4 1 1 6 7 0;
	setAttr -s 3 -ch 12 ".fc[0:2]" -type "polyFaces" 
		f 4 8 -1 7 4
		mu 0 4 0 1 2 3
		f 4 6 -2 -9 5
		mu 0 4 4 5 1 0
		f 4 9 -3 -4 1
		mu 0 4 5 7 6 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape89" -p "polySurface54";
	rename -uid "A2DBEF20-45BA-94D5-3B89-8B9AFD0159A2";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:2]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 3 "e[0]" "e[4]" "e[7]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.29166662693023682 0.625 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 0.75 0.5 0.5
		 0 0.5 0 0.75 0.58333325 0.75 0.58333325 0.5 0.5 0 0.58333325 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  435 -39.999496 0 435 -39.999496 
		0 435 0 0 435 0 0 435 0 0 435 0 0 435 -39.999496 0 435 0 0;
	setAttr -s 8 ".vt[0:7]"  -208.5 240 -496 -208.5 240 -326 -208.5 1.0325074e-14 -326
		 -208.5 400 -496 -208.5 400 -326 -208.49998474 400 -176 -208.49998474 240 -176 -208.49998474 1.8651747e-14 -176;
	setAttr -s 10 ".ed[0:9]"  0 3 0 0 1 0 1 6 1 2 7 0 4 1 1 1 2 0 3 4 0
		 5 6 0 4 5 0 6 7 0;
	setAttr -s 3 -ch 12 ".fc[0:2]" -type "polyFaces" 
		f 4 4 -2 0 6
		mu 0 4 0 1 2 3
		f 4 7 -3 -5 8
		mu 0 4 4 5 1 0
		f 4 -6 2 9 -4
		mu 0 4 6 1 5 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface18" -p "group11";
	rename -uid "C343B59A-421F-829B-BA9B-F2B5F36A8A58";
	setAttr ".t" -type "double3" 434.9999899529659 0 -6.2000274658203125 ;
	setAttr ".rp" -type "double3" -73.336715698242188 209.31364440917969 -495.99998474121094 ;
	setAttr ".sp" -type "double3" -73.336715698242188 209.31364440917969 -495.99998474121094 ;
createNode mesh -n "polySurfaceShape18" -p "polySurface18";
	rename -uid "3B36A13F-4218-1C32-41B3-8A9C37687396";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".pv" -type "double2" 0.24380093067884445 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.52973998 1 0.12039585
		 1 0.26486999 0 0.060197927 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  12.19659424 335.4989624 -496 -158.67834473 418.62728882 -495.99996948
		 12.094116211 1.9388252e-14 -496 -158.87002563 1.1974303e-14 -495.99996948;
	setAttr -s 4 ".ed[0:3]"  0 2 0 1 0 0 3 2 0 1 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 2 -1 -2
		mu 0 4 1 3 2 0;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape28" -p "polySurface18";
	rename -uid "CB9E9483-4EE4-AAFF-6705-019168D794CF";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 2 "f[0]" "f[1]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 3 "e[1]" "e[3]" "e[6]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 6 ".uvst[0].uvsp[0:5]" -type "float2" 0.39730492 0.5 0.52973998
		 1 0.12039585 1 0.090296879 0.5 0.26486999 0 0.060197927 0;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 6 ".vt[0:5]"  12.14532471 199.99996948 -496 12.19659424 335.4989624 -496
		 -158.67834473 418.62728882 -495.99996948 -158.77416992 200.00039672852 -496 12.094116211 1.9388252e-14 -496
		 -158.87002563 1.1974303e-14 -495.99996948;
	setAttr -s 7 ".ed[0:6]"  1 0 0 2 1 0 2 3 0 0 3 1 0 4 0 3 5 0 5 4 0;
	setAttr -s 2 -ch 8 ".fc[0:1]" -type "polyFaces" 
		f 4 -1 -2 2 -4
		mu 0 4 0 1 2 3
		f 4 -5 3 5 6
		mu 0 4 4 0 3 5;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface55" -p "group11";
	rename -uid "795F274E-4372-FE53-A766-0A96517C5902";
	setAttr ".t" -type "double3" 416.82530916640007 -1.4210854715202004e-14 536.3408762285685 ;
	setAttr ".s" -type "double3" 1 1 0.94423563755759665 ;
	setAttr ".rp" -type "double3" 226.49998474121094 100.00025177001953 -347.95083243997436 ;
	setAttr ".sp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
	setAttr ".spt" -type "double3" 0 0 20.549167560025658 ;
createNode mesh -n "polySurfaceShape55" -p "polySurface55";
	rename -uid "2FCE5546-4FFF-6852-E341-C092BF613A21";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 1 2 -4 0
		mu 0 4 0 2 3 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape90" -p "polySurface55";
	rename -uid "D997EEE4-47C6-F9C8-692A-44B9D281D51F";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pPlane1" -p "group11";
	rename -uid "F24275E3-42F9-27CD-73D8-8FB7B93C22DB";
createNode mesh -n "pPlaneShape1" -p "pPlane1";
	rename -uid "D5D85E9A-4C03-0285-EB2A-8991EC67FA74";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 1 "e[3]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "e[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 1 "e[1]";
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 1 "e[2]";
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 1 "e[0:3]";
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 0.45665324 0
		 0 1 0.45665324 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  -226.5 0 496 226.5 0 496 -226.5 0 -496 226.5 0 -496;
	setAttr -s 4 ".ed[0:3]"  0 1 0 0 2 0 1 3 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 0 2 -4 -2
		mu 0 4 0 1 3 2;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface56" -p "group11";
	rename -uid "9C9F0E5B-424B-6D5C-899D-9C8CE7B45AD7";
	setAttr ".t" -type "double3" -6.4999847412109375 0 0 ;
	setAttr ".rp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
	setAttr ".sp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
createNode mesh -n "polySurfaceShape56" -p "polySurface56";
	rename -uid "4091F8B2-48CC-34BC-1468-52B1D0BCA5A6";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 1 2 -4 0
		mu 0 4 0 2 3 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape91" -p "polySurface56";
	rename -uid "F773D14E-48D7-679E-47F7-469F01F41E8B";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface57" -p "group11";
	rename -uid "646EC0F9-4E80-3F8A-CCDD-D088FC1BCB9F";
	setAttr ".t" -type "double3" -6.4999847412109375 0 -85 ;
	setAttr ".rp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
	setAttr ".sp" -type "double3" 226.49998474121094 100.00025177001953 -368.5 ;
createNode mesh -n "polySurfaceShape57" -p "polySurface57";
	rename -uid "A4263BA7-459D-0E5E-3C40-DFB56638CFAD";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 1 2 -4 0
		mu 0 4 0 2 3 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape92" -p "polySurface57";
	rename -uid "6B20BE80-4AEB-B7B4-D0A8-A189DA13F427";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface58" -p "group11";
	rename -uid "2D85C894-4C84-4E62-061D-338623ED8FA9";
	setAttr ".t" -type "double3" -4 0 0 ;
	setAttr ".rp" -type "double3" 226.5 100.00025177001953 -411 ;
	setAttr ".sp" -type "double3" 226.5 100.00025177001953 -411 ;
createNode mesh -n "polySurfaceShape58" -p "polySurface58";
	rename -uid "8AA3730B-4799-1CDC-B1DB-AEA5F5C2C21B";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 19 18 -17 -15
		mu 0 4 16 19 18 17
		f 4 16 24 -24 -22
		mu 0 4 17 18 21 20
		f 4 23 29 -29 -27
		mu 0 4 20 21 23 22
		f 4 28 -32 -20 30
		mu 0 4 22 23 19 16
		f 4 3 5 -7 -5
		mu 0 4 8 9 10 11
		f 4 2 7 -9 -6
		mu 0 4 9 12 13 10
		f 4 0 9 -11 -8
		mu 0 4 12 14 15 13
		f 4 -2 4 11 -10
		mu 0 4 14 8 11 15
		f 4 12 14 -14 -4
		mu 0 4 2 16 17 3
		f 4 15 -19 -18 6
		mu 0 4 5 18 19 4
		f 4 13 21 -21 -3
		mu 0 4 3 17 20 0
		f 4 22 -25 -16 8
		mu 0 4 6 21 18 5
		f 4 20 26 -26 -1
		mu 0 4 0 20 22 1
		f 4 27 -30 -23 10
		mu 0 4 7 23 21 6
		f 4 25 -31 -13 1
		mu 0 4 1 22 16 2
		f 4 17 31 -28 -12
		mu 0 4 4 19 23 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface59" -p "group11";
	rename -uid "91AC26CD-4AE1-E9DD-0D12-BCBC968886A1";
	setAttr ".t" -type "double3" 419.32529390761101 -1.4210854715202004e-14 536.3408762285685 ;
	setAttr ".s" -type "double3" 1 1 0.94423563755759665 ;
	setAttr ".rp" -type "double3" 226.5 100.00025177001953 -388.08084703617226 ;
	setAttr ".sp" -type "double3" 226.5 100.00025177001953 -411 ;
	setAttr ".spt" -type "double3" 0 0 22.919152963827756 ;
createNode mesh -n "polySurfaceShape59" -p "polySurface59";
	rename -uid "B0A950AE-4356-FDD4-B33E-2E8051969D90";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:15]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 24 ".uvst[0].uvsp[0:23]" -type "float2" 1 0 1 1 0.5 1 0.5
		 0 0.5 1 0.5 0 1 0 1 1 0.5 1 0.5 0 0.5 0 0.5 1 1 0 1 0 1 1 1 1 0.5 1 0.5 0 0.5 0 0.5
		 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 16 ".vt[0:15]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331 224 1.4210855e-14 -411 224 200.00050354004 -411
		 224 195.00050354004 -406 224 5 -406 224 200.00050354004 -326 224 195.00050354004 -331
		 224 1.4210855e-14 -326 224 5 -331;
	setAttr -s 32 ".ed[0:31]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0 2 8 0 3 9 0 8 9 0 5 10 0 9 10 1 4 11 0 11 10 0 8 11 1
		 1 12 0 9 12 0 6 13 0 12 13 1 10 13 0 0 14 0 12 14 0 7 15 0 14 15 1 13 15 0 8 14 0
		 11 15 0;
	setAttr -s 16 -ch 64 ".fc[0:15]" -type "polyFaces" 
		f 4 19 18 -17 -15
		mu 0 4 16 19 18 17
		f 4 16 24 -24 -22
		mu 0 4 17 18 21 20
		f 4 23 29 -29 -27
		mu 0 4 20 21 23 22
		f 4 28 -32 -20 30
		mu 0 4 22 23 19 16
		f 4 3 5 -7 -5
		mu 0 4 8 9 10 11
		f 4 2 7 -9 -6
		mu 0 4 9 12 13 10
		f 4 0 9 -11 -8
		mu 0 4 12 14 15 13
		f 4 -2 4 11 -10
		mu 0 4 14 8 11 15
		f 4 12 14 -14 -4
		mu 0 4 2 16 17 3
		f 4 15 -19 -18 6
		mu 0 4 5 18 19 4
		f 4 13 21 -21 -3
		mu 0 4 3 17 20 0
		f 4 22 -25 -16 8
		mu 0 4 6 21 18 5
		f 4 20 26 -26 -1
		mu 0 4 0 20 22 1
		f 4 27 -30 -23 10
		mu 0 4 7 23 21 6
		f 4 25 -31 -13 1
		mu 0 4 1 22 16 2
		f 4 17 31 -28 -12
		mu 0 4 4 19 23 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface25" -p "group11";
	rename -uid "B5762F4E-4074-C3A7-396C-F39EFEB4BD9E";
createNode mesh -n "polySurfaceShape60" -p "polySurface25";
	rename -uid "0F3837A1-49BB-8718-B063-AE9849A36DA8";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:205]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 79 "f[2]" "f[8]" "f[11]" "f[14]" "f[15]" "f[16]" "f[17]" "f[21]" "f[29]" "f[38]" "f[39]" "f[40]" "f[48]" "f[49]" "f[50]" "f[54]" "f[55]" "f[56]" "f[57]" "f[58]" "f[59]" "f[60]" "f[61]" "f[62]" "f[63]" "f[64]" "f[65]" "f[66]" "f[67]" "f[73]" "f[74]" "f[75]" "f[81]" "f[82]" "f[83]" "f[87]" "f[94]" "f[102]" "f[105]" "f[114]" "f[117]" "f[118]" "f[121]" "f[134]" "f[135]" "f[136]" "f[137]" "f[138]" "f[139]" "f[140]" "f[141]" "f[142]" "f[143]" "f[144]" "f[145]" "f[164]" "f[165]" "f[166]" "f[167]" "f[168]" "f[169]" "f[170]" "f[171]" "f[172]" "f[173]" "f[174]" "f[175]" "f[186]" "f[187]" "f[188]" "f[189]" "f[198]" "f[199]" "f[200]" "f[201]" "f[202]" "f[203]" "f[204]" "f[205]";
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 32 "f[3]" "f[9]" "f[12]" "f[20]" "f[22]" "f[23]" "f[28]" "f[30]" "f[31]" "f[41]" "f[42]" "f[43]" "f[51]" "f[52]" "f[53]" "f[85]" "f[86]" "f[91]" "f[92]" "f[93]" "f[98]" "f[101]" "f[106]" "f[109]" "f[110]" "f[113]" "f[128]" "f[129]" "f[130]" "f[158]" "f[159]" "f[160]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 27 "f[0]" "f[6]" "f[13]" "f[19]" "f[27]" "f[34]" "f[44]" "f[69]" "f[70]" "f[71]" "f[77]" "f[78]" "f[79]" "f[84]" "f[90]" "f[122]" "f[123]" "f[124]" "f[149]" "f[150]" "f[151]" "f[152]" "f[153]" "f[154]" "f[179]" "f[180]" "f[181]";
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 9 "f[5]" "f[68]" "f[76]" "f[125]" "f[126]" "f[127]" "f[155]" "f[156]" "f[157]";
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 9 "f[4]" "f[24]" "f[32]" "f[146]" "f[147]" "f[148]" "f[176]" "f[177]" "f[178]";
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 36 "f[1]" "f[7]" "f[10]" "f[18]" "f[25]" "f[26]" "f[33]" "f[35]" "f[36]" "f[37]" "f[45]" "f[46]" "f[47]" "f[72]" "f[80]" "f[88]" "f[89]" "f[95]" "f[96]" "f[97]" "f[98]" "f[101]" "f[106]" "f[109]" "f[110]" "f[113]" "f[131]" "f[132]" "f[133]" "f[161]" "f[162]" "f[163]" "f[194]" "f[195]" "f[196]" "f[197]";
	setAttr ".pv" -type "double2" 0.49999991059303284 0.625 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 230 ".uvst[0].uvsp[0:229]" -type "float2" 0.375 0 0.39166665
		 0 0.39166662 0.025 0.37499997 0.025 0.375 0.25 0.39166665 0.25 0.39166674 0.26666668
		 0.37499997 0.26666668 0.375 0.72499996 0.39166665 0.72499996 0.39166665 0.74999994
		 0.375 0.75 0.375 0.98333323 0.39166665 0.98333317 0.39166665 1 0.375 1 0.625 0 0.64166677
		 0 0.64166677 0.025 0.625 0.025 0.375 0 0.39166665 0 0.39166662 0.025 0.37499997 0.025
		 0.375 0.25 0.39166665 0.25 0.39166674 0.26666668 0.37499997 0.26666668 0.375 0.72499996
		 0.39166665 0.72499996 0.39166665 0.74999994 0.375 0.75 0.375 0.98333323 0.39166665
		 0.98333317 0.39166665 1 0.375 1 0.35833326 0.025000006 0.35833326 0 0.37937498 0.26666668
		 0.37937501 0.25 0.37937498 0.72499996 0.375 0.72499996 0.375 0.75 0.37937501 0.75
		 0.37937501 1 0.37937498 0.98333323 0.37937501 0.025000006 0.37937501 0 0.375 0.5
		 0.39166665 0.5 0.39166665 0.5 0.37499997 0.5 0.625 0.72499996 0.625 0.72499996 0.625
		 0.75 0.625 0.74999994 0.37499997 0.74999994 0.39166665 0.74999994 0.39166665 0.74999994
		 0.37499997 0.72499996 0.37937501 0.48333323 0.375 0.48333323 0.39166677 0.48333323
		 0.375 0.48333323 0.14166668 0.025000006 0.14166667 0 0.375 0.76666665 0.39166665
		 0.76666665 0.37937498 0.76666665 0.375 0.76666665 0.39166665 0.76666665 0.85833329
		 0.025 0.85833335 0 0.39166677 0.48333323 0.37937501 0.5 0.39166665 0.5 0.375 0.5
		 0.125 0 0.125 0.025000006 0.875 0.025000006 0.875 0 0.60833317 0.025 0.60833317 0
		 0.60833317 0.25 0.60833335 0.26666668 0.60833335 0.48333323 0.60833317 0.5 0.60833311
		 0.5 0.60833317 0.72499996 0.60833317 0.75 0.60833317 0.75 0.60833317 0.75 0.60833317
		 0.76666665 0.60833317 0.98333323 0.60833317 1 0.625 0.25 0.625 0.26666668 0.625 0.48333323
		 0.625 0.5 0.625 0.5 0.625 0.72499996 0.625 0.75 0.625 0.76666665 0.625 0.98333323
		 0.625 1 0.375 0.72499996 0.375 0.75 0.39166665 0.74999994 0.60833317 0.75 0.625 0.75
		 0.625 0.72499996 0.625 0.5 0.60833317 0.5 0.39166665 0.5 0.375 0.5 0.60833317 0.5
		 0.625 0.5 0.39166665 0.5 0.375 0.5 0.60833317 0.025 0.60833317 0 0.60833317 0.25
		 0.60833335 0.26666668 0.60833335 0.48333323 0.60833317 0.5 0.60833317 0.72499996
		 0.60833317 0.75 0.60833317 0.76666665 0.60833317 0.98333323 0.60833317 1 0.625 0.025
		 0.625 0 0.625 0.25 0.625 0.26666668 0.625 0.48333323 0.625 0.5 0.625 0.72499996 0.625
		 0.75 0.625 0.76666665 0.625 0.98333323 0.625 1 0.62062496 0.025000006 0.62062496
		 0 0.62062496 1 0.62062502 0.98333323 0.62062502 0.76666665 0.62062496 0.75 0.62062496
		 0.72499996 0.62062496 0.5 0.62062496 0.48333323 0.62062496 0.26666668 0.62062496
		 0.25 0.62062496 0.33833334 0.62062496 0.51166654 0.37937495 0.33833334 0.37937498
		 0.51166654 0.39166662 0.52499998 0.60833317 0.52499998 0.39166662 0.52499998 0.60833311
		 0.52499998 0.62062502 0.73833334 0.37937498 0.73833334 0.37937498 0.91166663 0.62062496
		 0.33833334 0.37937495 0.33833334 0.37937498 0.91166663 0.62062502 0.91166663 0.62062502
		 0.91166663 0.60833311 0.52499998 0.60833317 0.52499998 0.60833317 0.72500002 0.60833317
		 0.72500002 0.60833317 0.72500002 0.39166665 0.72499996 0.39166662 0.52499998 0.39166662
		 0.52499998 0.39166665 0.72499996 0.39166665 0.72499996 0.39166665 0.72499996 0.60833317
		 0.72500002 0.375 0.22500002 0.37937501 0.22500002 0.62062502 0.22500002 0.625 0.22500002
		 0.60833317 0.22500002 0.39166665 0.22500002 0.375 0.22500002 0.35833329 0.22500002
		 0.14166676 0.22500002 0.125 0.22500002 0.375 0.52499998 0.39166668 0.52499998 0.60833317
		 0.72499996 0.39166665 0.72499996 0.39166668 0.52499998 0.60833317 0.52499998 0.60833317
		 0.52499998 0.625 0.52499998 0.62062502 0.52499998 0.62062502 0.52499998 0.37937501
		 0.52499998 0.37937498 0.72499996 0.62062496 0.72499996 0.37937501 0.52499998 0.375
		 0.52499998 0.37499997 0.52499998 0.375 0.72499996 0.37499997 0.72499996 0.37499997
		 0.52499998 0.375 0.52499998 0.375 0.52499998 0.375 0.52499998 0.39166668 0.52499998
		 0.60833317 0.52499998 0.625 0.52499998 0.625 0.52499998 0.625 0.52499998 0.625 0.52499998
		 0.87500006 0.22500002 0.85833323 0.22500002 0.64166665 0.22500002 0.625 0.22500002
		 0.60833317 0.22500002 0.39166665 0.22500002 0.35833329 0.25 0.14166677 0.25 0.125
		 0.25 0.85833323 0.25 0.875 0.25 0.64166665 0.25;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 204 ".vt";
	setAttr ".vt[0:165]"  1038.5 -200.5 225 1163.5 -200.5 225 1038.5 -182 225
		 1163.5 -182 225 1038.5 -182 102 1163.5 -182 102 1038.5 -200.5 102 1163.5 -200.5 102
		 755.5 -18.5 225 813.63165283 -18.5 225 755.5 0 225 813.63165283 0 225 755.5 0 103
		 813.63165283 0 103 755.5 -18.5 103 813.63165283 -18.5 103 1038.5 -238.5 -21 1163.5 -238.5 -21
		 1163.5 -257 -21 1038.5 -257 -21 1038.5 -182 216.79998779 813.63165283 0 216.86665344
		 755.5 0 216.86665344 755.5 -18.5 216.86662292 813.63165283 -18.5 216.86662292 1038.5 -200.5 216.79995728
		 1163.5 -200.5 216.79995728 1163.49987793 -182 216.79998779 1038.5 -182 110.20005035
		 813.63165283 0 111.1333847 755.5 0 111.1333847 755.5 -18.5 111.1333313 813.63165283 -18.5 111.1333313
		 1038.5 -200.5 110.20000458 1163.5 -200.5 110.20000458 1163.5 -182 110.20005035 1046.83325195 -200.49998474 225
		 1046.83325195 -182 225 1046.83337402 -182 216.79998779 1046.83337402 -182 110.20005035
		 1046.83325195 -182 102 1046.83325195 -238.5 -21 1046.83325195 -257 -21 1046.83325195 -200.49998474 102
		 1046.83325195 -200.49998474 110.20000458 1046.83325195 -200.49998474 216.79995728
		 1155.16662598 -200.5 225 1155.16662598 -182 225 1155.16650391 -182 216.79998779 1155.16662598 -182 110.20005035
		 1155.16662598 -182 102 1155.16662598 -238.5 -21 1155.16662598 -257 -21 1155.16662598 -200.5 102
		 1155.16662598 -200.5 110.20000458 1155.16662598 -200.5 216.79995728 1038.5 -182 93.79999542
		 1038.5 -200.5 93.79999542 1046.83325195 -200.50001526 93.79995728 1155.16662598 -200.50001526 93.79995728
		 1163.49987793 -200.5 93.79999542 1163.49987793 -182 93.79999542 1155.16650391 -182 93.79999542
		 1046.83325195 -182 93.79999542 1038.5 -238.50001526 -12.79994965 1038.5 -257 -12.79994965
		 1046.83325195 -257.000030517578 -12.80000114 1155.16662598 -257.000030517578 -12.80000114
		 1163.5 -257 -12.79994965 1163.5 -238.50001526 -12.79994965 1155.16662598 -238.50001526 -12.79994965
		 1046.83325195 -238.50001526 -12.79994965 759.37542725 -18.5 225 759.37542725 0 225
		 759.37542725 0 216.86665344 759.37542725 0 111.13339233 759.37542725 0 103 759.37542725 -18.5 103
		 759.37542725 -18.5 111.13332367 759.37542725 -18.5 216.86660767 809.75622559 -18.5 225
		 809.75622559 0 225 809.75622559 0 216.86665344 809.75622559 0 111.1333847 809.75622559 0 103
		 809.75622559 -18.5 103 809.75622559 -18.5 111.1333313 809.75622559 -18.5 216.86662292
		 1034.56481934 -182 225 1034.56481934 -200.5 225 1034.56481934 -200.5 216.8011322
		 1034.56481934 -200.5 110.21633911 1034.56481934 -200.5 102.017501831 1034.56481934 -182 102.017501831
		 1034.56481934 -182 110.21638489 1034.56481934 -182 216.80116272 817.56689453 0 225
		 817.56689453 -18.5 225 817.5668335 -18.49994278 216.86546326 817.5668335 -18.49994278 111.11699677
		 817.56689453 -18.5 102.98249817 817.56689453 0 102.98249817 817.56689453 0 111.11705017
		 817.56689453 0 216.86547852 817.56689453 -1.84999418 111.11704254 1034.56481934 -183.8500061 110.21637726
		 1034.56481934 -183.8500061 216.80116272 817.56689453 -1.84999418 216.86547852 817.5668335 -16.64995193 111.11699677
		 1034.56481934 -198.65000916 110.21633911 1034.56481934 -198.65000916 216.8011322
		 817.5668335 -16.64995193 216.86546326 1155.16650391 -240.3500061 -12.79995441 1155.16650391 -183.84999084 93.79998779
		 1046.83325195 -183.84999084 93.79998779 1046.83325195 -240.3500061 -12.79995441 1155.16662598 -255.15002441 -12.79999542
		 1155.16662598 -198.65000916 93.7999649 1046.83325195 -198.65000916 93.7999649 1046.83325195 -255.15002441 -12.79999542
		 1038.5 -198.6499939 225 1034.56481934 -198.6499939 225 817.56689453 -16.64999962 225
		 813.63165283 -16.64999962 225 809.75622559 -16.64999962 225 759.37542725 -16.64999962 225
		 755.5 -16.64999962 225 755.5 -16.64999962 216.86663818 755.5 -16.64999962 111.13333893
		 755.5 -16.64999962 103 759.37542725 -16.64999962 103 809.75622559 -16.64999962 103
		 813.63165283 -16.64999962 103 817.56689453 -16.64999962 102.98249054 1034.56481934 -198.6499939 102.017501831
		 1038.5 -198.6499939 102 1038.5 -198.65000916 93.79999542 1038.5 -255.15000916 -12.79994965
		 1038.5 -255.1499939 -21 1046.83325195 -255.1499939 -21 1155.16662598 -255.1499939 -21
		 1163.5 -255.1499939 -21 1163.5 -255.1499939 -12.79994965 1163.49987793 -198.6499939 93.79998779
		 1163.5 -198.6499939 102 1163.5 -198.6499939 110.20000458 1163.5 -198.6499939 216.79994202
		 1163.5 -198.6499939 225 1155.16650391 -198.6499939 225 1046.83325195 -198.64997864 225
		 1038.5 -183.8500061 225 1034.56481934 -183.84999084 225 817.56695557 -1.849998 225
		 813.6315918 -1.84999788 225 809.75622559 -1.84999788 225 759.37542725 -1.84999788 225
		 755.5 -1.84999788 225 755.5 -1.84999812 216.86665344 755.5 -1.84999812 111.1333847
		 755.5 -1.84999812 103 759.37542725 -1.84999812 103 809.75622559 -1.84999812 103 813.63165283 -1.84999812 103
		 817.56689453 -1.849998 102.98249817 1034.56481934 -183.84999084 102.017501831 1038.5 -183.8500061 102;
	setAttr ".vt[166:203]" 1038.5 -183.8500061 93.79999542 1038.5 -240.35002136 -12.79994965
		 1038.5 -240.3500061 -21 1046.83325195 -240.3500061 -21 1155.16662598 -240.3500061 -21
		 1163.5 -240.3500061 -21 1163.5 -240.3500061 -12.79994965 1163.49987793 -183.8500061 93.79999542
		 1163.5 -183.8500061 102 1163.5 -183.8500061 110.20004272 1163.49987793 -183.8500061 216.79997253
		 1163.5 -183.8500061 225 1155.16662598 -183.8500061 225 1046.83325195 -183.84999084 225
		 1034.56567383 -183.8500061 219.80116272 817.56781006 -1.84999883 219.86547852 1034.56567383 -198.65000916 219.8011322
		 817.56774902 -16.64995575 219.86546326 1158.16650391 -240.34999084 -12.79996777 1158.16650391 -183.84997559 93.79997253
		 1158.16662598 -255.15000916 -12.80000877 1158.16662598 -198.6499939 93.79994965 1043.83325195 -183.84999084 93.79998779
		 1043.83325195 -240.3500061 -12.79995441 1043.83325195 -198.65000916 93.7999649 1043.83325195 -255.15002441 -12.79999542
		 759.37542725 -16.64999962 106 809.75622559 -16.64999962 106 759.37542725 -1.84999812 106
		 809.75622559 -1.84999812 106 817.58026123 -1.84999883 105.98246765 1034.578125 -183.84999084 105.017471313
		 1034.578125 -198.6499939 105.017471313 817.58026123 -16.64999962 105.98246002 1041.5 -198.65000916 93.79999542
		 1041.5 -255.15000916 -12.79994965 1041.5 -183.8500061 93.79999542 1041.5 -240.35002136 -12.79994965;
	setAttr -s 412 ".ed";
	setAttr ".ed[0:165]"  0 36 0 2 37 0 4 40 1 6 43 1 0 120 0 1 147 0 2 20 0
		 3 27 0 4 165 0 5 174 1 6 33 0 7 34 0 8 72 0 10 73 0 12 76 0 14 77 0 8 126 0 9 123 0
		 10 22 0 11 21 0 12 159 0 13 162 0 14 31 0 15 32 0 2 88 0 4 93 0 6 92 0 0 89 0 4 56 0
		 5 61 0 16 41 0 7 60 0 17 171 0 6 57 0 19 42 0 16 168 0 20 28 0 21 29 0 22 30 0 23 8 0
		 24 9 0 25 0 0 26 1 0 27 35 0 20 95 1 21 82 1 22 157 1 23 79 1 24 98 1 25 45 1 26 146 1
		 27 48 1 28 4 0 29 13 0 30 12 0 31 23 0 32 24 0 33 25 0 34 26 0 35 5 0 28 94 1 29 83 1
		 30 158 1 31 78 1 32 99 1 33 44 1 34 145 1 35 49 1 36 46 0 37 47 0 38 20 1 39 28 1
		 40 50 1 41 51 0 42 52 0 43 53 1 44 54 1 45 55 1 36 149 1 37 38 1 38 39 1 39 40 1
		 40 63 1 41 169 1 42 66 1 43 44 1 44 45 1 45 36 1 46 1 0 47 3 0 48 38 1 49 39 1 50 5 1
		 51 17 0 52 18 0 53 7 1 54 34 1 55 26 1 46 148 1 47 48 1 48 49 1 49 50 1 50 62 1 51 170 1
		 52 67 1 53 54 1 54 55 1 55 46 1 56 64 0 57 65 0 58 43 1 59 53 1 60 68 0 61 69 0 62 70 0
		 63 71 0 56 166 1 57 58 1 58 59 0 59 60 1 60 143 1 61 62 1 62 63 0 63 56 1 64 16 0
		 65 19 0 66 58 0 67 59 0 68 18 0 69 17 0 70 51 1 71 41 1 64 167 1 65 66 1 66 67 0
		 67 68 1 68 142 1 69 70 1 70 71 0 71 64 1 72 80 0 73 81 0 74 22 1 75 30 1 76 84 0
		 77 85 0 78 86 1 79 87 1 72 125 1 73 74 1 74 75 1 75 76 1 76 160 1 77 78 1 78 79 1
		 79 72 1 80 9 0 81 11 0 82 74 1 83 75 1 84 13 0 85 15 0 86 32 1 87 24 1 80 124 1 81 82 1;
	setAttr ".ed[166:331]" 82 83 1 83 84 1 84 161 1 85 86 1 86 87 1 87 80 1 88 96 0
		 89 97 0 90 25 1 91 33 1 92 100 0 93 101 0 94 102 0 95 103 0 88 151 1 89 90 1 90 91 0
		 91 92 1 92 134 1 93 94 1 94 95 0 95 88 1 96 11 0 97 9 0 98 90 0 99 91 0 100 15 0
		 101 13 0 102 29 1 103 21 1 96 152 1 97 98 1 98 99 0 99 100 1 100 133 1 101 102 1
		 102 103 0 103 96 1 102 104 0 103 107 0 95 106 0 94 105 0 70 112 0 71 115 0 63 114 0
		 62 113 0 104 108 0 105 109 0 106 110 1 107 111 1 104 105 1 105 106 1 106 107 0 107 104 1
		 108 99 0 109 91 0 110 90 0 111 98 0 108 109 1 109 110 1 110 111 0 111 108 1 112 116 1
		 113 117 1 114 118 1 115 119 1 112 113 0 113 114 1 114 115 0 115 112 1 116 67 0 117 59 0
		 118 58 0 119 66 0 116 117 0 117 118 1 118 119 0 119 116 1 120 150 0 121 89 1 122 97 1
		 123 153 0 124 154 1 125 155 1 126 156 0 127 23 1 128 31 1 129 14 0 130 77 1 131 85 1
		 132 15 0 133 163 0 134 164 0 135 6 0 136 57 1 137 65 1 138 19 0 139 42 1 140 52 1
		 141 18 0 142 172 1 143 173 1 144 7 1 145 175 1 146 176 1 147 177 0 148 178 1 149 179 1
		 120 121 1 121 122 1 122 123 1 123 124 1 124 125 1 125 126 1 126 127 1 127 128 1 128 129 1
		 129 130 1 130 131 0 131 132 1 132 133 1 133 134 0 134 135 1 135 136 1 136 137 0 137 138 1
		 138 139 1 139 140 1 140 141 1 141 142 1 142 143 1 143 144 1 144 145 1 145 146 1 146 147 1
		 147 148 1 148 149 1 149 120 1 150 2 0 151 121 1 152 122 1 153 11 0 154 81 1 155 73 1
		 156 10 0 157 127 1 158 128 1 159 129 0 160 130 0 161 131 0 162 132 0 163 101 1 164 93 1
		 165 135 0 166 136 0 167 137 0 168 138 0 169 139 1 170 140 1 171 141 0 172 69 1 173 61 1
		 174 144 1 175 35 1 176 27 1 177 3 0;
	setAttr ".ed[332:411]" 178 47 1 179 37 1 150 151 1 151 152 1 152 153 1 153 154 1
		 154 155 1 155 156 1 156 157 1 157 158 1 158 159 1 159 160 1 160 161 0 161 162 1 162 163 1
		 163 164 0 164 165 1 165 166 1 166 167 0 167 168 1 168 169 1 169 170 1 170 171 1 171 172 1
		 172 173 1 173 174 1 174 175 1 175 176 1 176 177 1 177 178 1 178 179 1 179 150 1 106 180 0
		 107 181 0 180 181 0 110 182 0 180 182 0 111 183 0 182 183 0 181 183 0 112 184 0 113 185 0
		 184 185 0 116 186 0 184 186 0 117 187 0 186 187 0 185 187 0 114 188 0 115 189 0 188 189 0
		 118 190 0 188 190 0 119 191 0 190 191 0 189 191 0 130 192 0 131 193 0 192 193 0 160 194 0
		 194 192 0 161 195 0 194 195 0 195 193 0 163 196 0 164 197 0 196 197 0 134 198 0 198 197 0
		 133 199 0 199 198 0 199 196 0 136 200 0 137 201 0 200 201 0 166 202 0 202 200 0 167 203 0
		 202 203 0 203 201 0;
	setAttr -s 206 -ch 824 ".fc[0:205]" -type "polyFaces" 
		f 4 0 78 303 -5
		mu 0 4 0 1 2 3
		f 4 1 79 70 -7
		mu 0 4 4 5 6 7
		f 4 292 263 -35 -263
		mu 0 4 8 9 10 11
		f 4 49 87 -1 -42
		mu 0 4 12 13 14 15
		f 4 -43 50 300 -6
		mu 0 4 16 17 18 19
		f 4 12 148 279 -17
		mu 0 4 20 21 22 23
		f 4 13 149 142 -19
		mu 0 4 24 25 26 27
		f 4 283 254 -16 -254
		mu 0 4 28 29 30 31
		f 4 47 155 -13 -40
		mu 0 4 32 33 34 35
		f 4 280 251 39 16
		mu 0 4 23 36 37 20
		f 4 6 44 187 -25
		mu 0 4 4 7 38 39
		f 4 288 259 26 184
		mu 0 4 40 41 42 43
		f 4 181 174 41 27
		mu 0 4 44 45 12 15
		f 4 4 274 245 -28
		mu 0 4 0 3 46 47
		f 4 2 82 123 -29
		mu 0 4 48 49 50 51
		f 4 297 268 31 120
		mu 0 4 52 53 54 55
		f 4 117 110 -4 33
		mu 0 4 56 57 58 42
		f 4 -260 289 260 -34
		mu 0 4 42 41 59 56
		f 4 186 -45 36 60
		mu 0 4 60 38 7 61
		f 4 -143 150 143 -39
		mu 0 4 27 26 62 63
		f 4 281 252 55 -252
		mu 0 4 36 64 65 37
		f 4 63 154 -48 -56
		mu 0 4 66 67 33 32
		f 4 182 175 57 -175
		mu 0 4 45 68 69 12
		f 4 65 86 -50 -58
		mu 0 4 69 70 13 12
		f 4 299 -51 -59 66
		mu 0 4 71 18 17 72
		f 4 -71 80 71 -37
		mu 0 4 7 6 73 61
		f 4 185 -61 52 25
		mu 0 4 74 60 61 48
		f 4 -144 151 -15 -55
		mu 0 4 63 62 75 76
		f 4 22 -253 282 253
		mu 0 4 77 65 64 78
		f 4 15 153 -64 -23
		mu 0 4 31 30 67 66
		f 4 10 -176 183 -27
		mu 0 4 42 69 68 43
		f 4 3 85 -66 -11
		mu 0 4 42 58 70 69
		f 4 298 -67 -12 -269
		mu 0 4 79 71 72 80
		f 4 -72 81 -3 -53
		mu 0 4 61 73 49 48
		f 4 302 -79 68 98
		mu 0 4 81 2 1 82
		f 4 -80 69 99 90
		mu 0 4 6 5 83 84
		f 4 -81 -91 100 91
		mu 0 4 73 6 84 85
		f 4 -82 -92 101 -73
		mu 0 4 49 73 85 86
		f 4 122 -83 72 102
		mu 0 4 87 50 49 86
		f 4 -264 293 264 -75
		mu 0 4 10 9 88 89
		f 4 118 111 -76 -111
		mu 0 4 57 90 91 58
		f 4 -86 75 105 -77
		mu 0 4 70 58 91 92
		f 4 -87 76 106 -78
		mu 0 4 13 70 92 93
		f 4 -88 77 107 -69
		mu 0 4 14 13 93 94
		f 4 301 -99 88 5
		mu 0 4 19 81 82 16
		f 4 -100 89 7 51
		mu 0 4 84 83 95 96
		f 4 -101 -52 43 67
		mu 0 4 85 84 96 97
		f 4 -102 -68 59 -93
		mu 0 4 86 85 97 98
		f 4 121 -103 92 29
		mu 0 4 99 87 86 98
		f 4 -265 294 265 -95
		mu 0 4 89 88 100 101
		f 4 -96 -112 119 -32
		mu 0 4 54 91 90 55
		f 4 -106 95 11 -97
		mu 0 4 92 91 54 102
		f 4 -107 96 58 -98
		mu 0 4 93 92 102 103
		f 4 -108 97 42 -89
		mu 0 4 94 93 103 104
		f 4 -261 290 261 -110
		mu 0 4 56 59 105 106
		f 4 133 126 -118 109
		mu 0 4 106 107 57 56
		f 4 -120 -128 135 -113
		mu 0 4 55 90 108 109
		f 4 296 -121 112 136
		mu 0 4 110 52 55 109
		f 4 137 -115 -122 113
		mu 0 4 111 112 87 99
		f 4 -124 115 139 -109
		mu 0 4 51 50 113 114
		f 4 -262 291 262 -126
		mu 0 4 106 105 8 11
		f 4 84 -134 125 34
		mu 0 4 10 107 106 11
		f 4 104 -135 -85 74
		mu 0 4 89 108 107 10
		f 4 -136 -105 94 -129
		mu 0 4 109 108 89 101
		f 4 295 -137 128 -266
		mu 0 4 100 110 109 101
		f 4 -131 -138 129 -94
		mu 0 4 115 112 111 116
		f 4 -132 -139 130 -74
		mu 0 4 117 113 112 115
		f 4 -140 131 -31 -125
		mu 0 4 114 113 117 118
		f 4 278 -149 140 164
		mu 0 4 119 22 21 120
		f 4 -150 141 165 158
		mu 0 4 26 25 121 122
		f 4 -151 -159 166 159
		mu 0 4 62 26 122 123
		f 4 -152 -160 167 -145
		mu 0 4 75 62 123 124
		f 4 -255 284 255 -146
		mu 0 4 30 29 125 126
		f 4 -154 145 169 -147
		mu 0 4 67 30 126 127
		f 4 -155 146 170 -148
		mu 0 4 33 67 127 128
		f 4 -156 147 171 -141
		mu 0 4 34 33 128 129
		f 4 277 -165 156 17
		mu 0 4 130 119 120 131
		f 4 -166 157 19 45
		mu 0 4 122 121 132 133
		f 4 -167 -46 37 61
		mu 0 4 123 122 133 134
		f 4 -168 -62 53 -161
		mu 0 4 124 123 134 135
		f 4 -256 285 256 -162
		mu 0 4 126 125 136 137
		f 4 -170 161 23 -163
		mu 0 4 127 126 137 138
		f 4 -171 162 56 -164
		mu 0 4 128 127 138 139
		f 4 -172 163 40 -157
		mu 0 4 129 128 139 140
		f 4 -246 275 246 -174
		mu 0 4 47 46 141 142
		f 4 197 190 -182 173
		mu 0 4 143 144 45 44
		f 4 -184 -192 199 -177
		mu 0 4 43 68 145 146
		f 4 287 -185 176 200
		mu 0 4 147 40 43 146
		f 4 201 -179 -186 177
		mu 0 4 148 149 60 74
		f 4 -188 179 203 -173
		mu 0 4 39 38 150 151
		f 4 -247 276 -18 -190
		mu 0 4 142 141 130 131
		f 4 48 -198 189 -41
		mu 0 4 139 144 143 140
		f 4 64 -199 -49 -57
		mu 0 4 138 145 144 139
		f 4 -200 -65 -24 -193
		mu 0 4 146 145 138 137
		f 4 286 -201 192 -257
		mu 0 4 136 147 146 137
		f 4 -195 -202 193 -54
		mu 0 4 134 149 148 135
		f 4 -196 -203 194 -38
		mu 0 4 133 150 149 134
		f 4 -204 195 -20 -189
		mu 0 4 151 150 133 132
		f 4 202 205 219 -205
		mu 0 4 149 150 152 153
		f 4 -180 206 218 -206
		mu 0 4 150 38 154 152
		f 4 -187 207 217 -207
		mu 0 4 38 60 155 154
		f 4 178 204 216 -208
		mu 0 4 60 149 153 155
		f 4 138 209 235 -209
		mu 0 4 112 113 156 157
		f 4 -116 210 234 -210
		mu 0 4 113 50 158 156
		f 4 -123 211 233 -211
		mu 0 4 50 87 159 158
		f 4 114 208 232 -212
		mu 0 4 87 112 157 159
		f 4 -217 212 224 -214
		mu 0 4 155 153 160 161
		f 4 -218 213 225 -215
		mu 0 4 154 155 161 162
		f 4 -367 368 370 -372
		mu 0 4 163 164 165 166
		f 4 -220 215 227 -213
		mu 0 4 153 152 167 160
		f 4 -225 220 191 -222
		mu 0 4 161 160 145 68
		f 4 -226 221 -183 -223
		mu 0 4 162 161 68 45
		f 4 -227 222 -191 -224
		mu 0 4 167 162 45 144
		f 4 -228 223 198 -221
		mu 0 4 160 167 144 145
		f 4 -375 376 378 -380
		mu 0 4 168 169 170 171
		f 4 -234 229 241 -231
		mu 0 4 158 159 172 173
		f 4 -383 384 386 -388
		mu 0 4 174 175 176 177
		f 4 -236 231 243 -229
		mu 0 4 157 156 178 179
		f 4 -241 236 127 -238
		mu 0 4 172 179 108 90
		f 4 -242 237 -119 -239
		mu 0 4 173 172 90 57
		f 4 -243 238 -127 -240
		mu 0 4 178 173 57 107
		f 4 -244 239 134 -237
		mu 0 4 179 178 107 108
		f 4 -275 244 334 305
		mu 0 4 46 3 180 181
		f 4 -276 -306 335 306
		mu 0 4 141 46 181 182
		f 4 -277 -307 336 -248
		mu 0 4 130 141 182 183
		f 4 337 -249 -278 247
		mu 0 4 183 184 119 130
		f 4 338 -250 -279 248
		mu 0 4 184 185 22 119
		f 4 -280 249 339 -251
		mu 0 4 23 22 185 186
		f 4 340 311 -281 250
		mu 0 4 186 187 36 23
		f 4 341 312 -282 -312
		mu 0 4 187 188 64 36
		f 4 -283 -313 342 313
		mu 0 4 78 64 188 189
		f 4 343 314 -284 -314
		mu 0 4 190 191 29 28
		f 4 -391 -393 394 395
		mu 0 4 192 193 194 195
		f 4 -286 -316 345 316
		mu 0 4 136 125 196 197
		f 4 346 -258 -287 -317
		mu 0 4 197 198 147 136
		f 4 398 -401 -403 403
		mu 0 4 199 200 201 202
		f 4 348 319 -289 258
		mu 0 4 203 204 41 40
		f 4 -290 -320 349 320
		mu 0 4 59 41 204 205
		f 4 -407 -409 410 411
		mu 0 4 206 207 208 209
		f 4 -292 -322 351 322
		mu 0 4 8 105 210 211
		f 4 352 323 -293 -323
		mu 0 4 211 212 9 8
		f 4 -294 -324 353 324
		mu 0 4 88 9 212 213
		f 4 -295 -325 354 325
		mu 0 4 100 88 213 214
		f 4 355 -267 -296 -326
		mu 0 4 214 215 110 100
		f 4 356 -268 -297 266
		mu 0 4 215 216 52 110
		f 4 357 328 -298 267
		mu 0 4 216 217 53 52
		f 4 358 -270 -299 -329
		mu 0 4 218 219 71 79
		f 4 359 -271 -300 269
		mu 0 4 219 220 18 71
		f 4 -301 270 360 -272
		mu 0 4 19 18 220 221
		f 4 361 -273 -302 271
		mu 0 4 221 222 81 19
		f 4 362 -274 -303 272
		mu 0 4 222 223 2 81
		f 4 -304 273 363 -245
		mu 0 4 3 2 223 180
		f 4 -335 304 24 180
		mu 0 4 181 180 4 39
		f 4 -336 -181 172 196
		mu 0 4 182 181 39 151
		f 4 -337 -197 188 -308
		mu 0 4 183 182 151 132
		f 4 -309 -338 307 -158
		mu 0 4 121 184 183 132
		f 4 -310 -339 308 -142
		mu 0 4 25 185 184 121
		f 4 -340 309 -14 -311
		mu 0 4 186 185 25 24
		f 4 46 -341 310 18
		mu 0 4 224 187 186 24
		f 4 62 -342 -47 38
		mu 0 4 225 188 187 224
		f 4 -343 -63 54 20
		mu 0 4 189 188 225 226
		f 4 14 152 -344 -21
		mu 0 4 76 75 191 190
		f 4 -345 -153 144 168
		mu 0 4 196 191 75 124
		f 4 -346 -169 160 21
		mu 0 4 197 196 124 135
		f 4 -318 -347 -22 -194
		mu 0 4 148 198 197 135
		f 4 -319 -348 317 -178
		mu 0 4 74 203 198 148
		f 4 8 -349 318 -26
		mu 0 4 48 204 203 74
		f 4 -350 -9 28 116
		mu 0 4 205 204 48 51
		f 4 -351 -117 108 132
		mu 0 4 210 205 51 114
		f 4 -352 -133 124 35
		mu 0 4 211 210 114 118
		f 4 30 83 -353 -36
		mu 0 4 118 117 212 211
		f 4 -354 -84 73 103
		mu 0 4 213 212 117 115
		f 4 -355 -104 93 32
		mu 0 4 214 213 115 116
		f 4 -327 -356 -33 -130
		mu 0 4 111 215 214 116
		f 4 -328 -357 326 -114
		mu 0 4 99 216 215 111
		f 4 9 -358 327 -30
		mu 0 4 98 217 216 99
		f 4 -330 -359 -10 -60
		mu 0 4 227 219 218 228
		f 4 -331 -360 329 -44
		mu 0 4 229 220 219 227
		f 4 -361 330 -8 -332
		mu 0 4 221 220 229 95
		f 4 -333 -362 331 -90
		mu 0 4 83 222 221 95
		f 4 -334 -363 332 -70
		mu 0 4 5 223 222 83
		f 4 -364 333 -2 -305
		mu 0 4 180 223 5 4
		f 4 -219 364 366 -366
		mu 0 4 152 154 164 163
		f 4 214 367 -369 -365
		mu 0 4 154 162 165 164
		f 4 226 369 -371 -368
		mu 0 4 162 167 166 165
		f 4 -216 365 371 -370
		mu 0 4 167 152 163 166
		f 4 -233 372 374 -374
		mu 0 4 159 157 169 168
		f 4 228 375 -377 -373
		mu 0 4 157 179 170 169
		f 4 240 377 -379 -376
		mu 0 4 179 172 171 170
		f 4 -230 373 379 -378
		mu 0 4 172 159 168 171
		f 4 -235 380 382 -382
		mu 0 4 156 158 175 174
		f 4 230 383 -385 -381
		mu 0 4 158 173 176 175
		f 4 242 385 -387 -384
		mu 0 4 173 178 177 176
		f 4 -232 381 387 -386
		mu 0 4 178 156 174 177
		f 4 -285 388 390 -390
		mu 0 4 125 29 193 192
		f 4 -315 391 392 -389
		mu 0 4 29 191 194 193
		f 4 344 393 -395 -392
		mu 0 4 191 196 195 194
		f 4 315 389 -396 -394
		mu 0 4 196 125 192 195
		f 4 347 397 -399 -397
		mu 0 4 198 203 200 199
		f 4 -259 399 400 -398
		mu 0 4 203 40 201 200
		f 4 -288 401 402 -400
		mu 0 4 40 147 202 201
		f 4 257 396 -404 -402
		mu 0 4 147 198 199 202
		f 4 -291 404 406 -406
		mu 0 4 105 59 207 206
		f 4 -321 407 408 -405
		mu 0 4 59 205 208 207
		f 4 350 409 -411 -408
		mu 0 4 205 210 209 208
		f 4 321 405 -412 -410
		mu 0 4 210 105 206 209;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface23" -p "group11";
	rename -uid "BE3EB097-49C6-BC6E-CCD4-DB9DC230E94A";
	setAttr ".t" -type "double3" 434.9999899529659 0 0 ;
createNode mesh -n "polySurfaceShape53" -p "polySurface23";
	rename -uid "0D213B4A-4F5F-8F6C-F360-55843A9F6618";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:18]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 4 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 2 "e[0]" "e[17]";
	setAttr ".gtag[2].gtagnm" -type "string" "right";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 2 "e[1]" "e[20]";
	setAttr ".gtag[3].gtagnm" -type "string" "rim";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 3 "e[0:1]" "e[17]" "e[20]";
	setAttr ".pv" -type "double2" 0.5 1.1226874589920044 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 51 ".uvst[0].uvsp[0:50]" -type "float2" 0 0.5 1 0 0.99999988
		 0.4375 0 0.75 0.75 0.5 0.5 0 1 0.5 0.97500002 0.50025862 0.97500002 0 1 0 0 0 3.129261e-10
		 0.51034355 0.39730492 0.5 0.26486999 0 0.97500002 1.00051724911 1 1 6.258522e-10
		 1.020687103 0.9999997 0.875 0 1 1 1 0.52973998 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1
		 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0.5 1 0 0 1 0 0.50000006 1.24537492 0 0 1 0 1 1 0 1 0
		 0 1 0 1 0.99999923 0 1 0 0 1 0 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 32 ".vt[0:31]"  -208.5 0 496 208.5 0 496 208.5 0 -496 312.5 0 -56
		 312.5 0 -496 312.5 240 -56 312.5 240 -496 208.5 240 -496 208.5 240 496 -208.5 438 496
		 -198.49998474 438 496 -198.71246338 0 496 -208.5 200.00050354004 496 -198.60623169 200.00050354004 496
		 208.5 199.99949646 496 312.5 199.99949646 -56 312.5 199.99949646 -496 208.5 199.99949646 -496
		 12.19659424 335.4989624 -496 12.14532471 199.99996948 -496 12.094116211 0 -496 -661.5 0 496
		 -661.5 200.00050354004 496 720.5 0 496 720.5 199.99949646 496 720.5 240 496 320.5 0 -56
		 320.5 0 -496 320.5 199.99949646 -56 320.5 240 -56 320.5 240 -496 320.5 199.99949646 -496;
	setAttr -s 49 ".ed[0:48]"  0 11 0 2 4 0 3 4 0 3 15 0 4 16 0 5 6 0 2 17 0
		 6 7 0 1 14 1 0 12 1 9 10 0 10 8 0 11 1 0 10 13 1 12 9 0 13 11 1 14 8 1 15 5 0 16 6 0
		 17 7 0 12 13 1 13 14 1 15 16 1 16 17 1 17 19 1 18 7 0 20 2 0 18 19 0 19 20 0 0 21 0
		 12 22 0 21 22 0 1 23 0 14 24 1 23 24 0 8 25 0 24 25 0 3 26 0 4 27 0 26 27 0 15 28 1
		 26 28 0 5 29 0 6 30 0 29 30 0 28 29 0 30 31 0 28 31 0 27 31 0;
	setAttr -s 19 -ch 76 ".fc[0:18]" -type "polyFaces" 
		f 4 -3 3 22 -5
		mu 0 4 0 1 2 3
		f 4 4 23 -7 1
		mu 0 4 0 3 4 5
		f 4 20 15 -1 9
		mu 0 4 6 7 8 9
		f 4 -13 -16 21 -9
		mu 0 4 10 8 7 11
		f 4 24 28 26 6
		mu 0 4 4 12 13 5
		f 4 13 -21 14 10
		mu 0 4 14 7 6 15
		f 4 -22 -14 11 -17
		mu 0 4 11 7 14 16
		f 4 -23 17 5 -19
		mu 0 4 3 2 17 18
		f 4 -24 18 7 -20
		mu 0 4 4 3 18 19
		f 4 -26 27 -25 19
		mu 0 4 19 20 12 4
		f 4 -10 29 31 -31
		mu 0 4 21 22 23 24
		f 4 8 33 -35 -33
		mu 0 4 25 26 27 28
		f 4 16 35 -37 -34
		mu 0 4 29 30 31 32
		f 4 2 38 -40 -38
		mu 0 4 33 34 35 36
		f 4 -4 37 41 -41
		mu 0 4 37 38 36 39
		f 4 -6 42 44 -44
		mu 0 4 40 41 42 43
		f 4 -18 40 45 -43
		mu 0 4 44 45 46 47
		f 4 -45 -46 47 -47
		mu 0 4 48 49 39 50
		f 4 39 48 -48 -42
		mu 0 4 36 35 50 39;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 2 
		36 0 
		39 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pCube1_1M_Ref5" -p "group11";
	rename -uid "DFCE8EA0-4F5B-19CE-725C-EDA1599B0FD8";
	setAttr ".t" -type "double3" 170 200.00050354003906 -446 ;
	setAttr ".s" -type "double3" 1 0.08 1 ;
	setAttr ".rp" -type "double3" 50 0 -50 ;
	setAttr ".sp" -type "double3" 50 0 -50 ;
createNode mesh -n "pCube1_1M_Ref5Shape" -p "pCube1_1M_Ref5";
	rename -uid "CA998F16-420B-0511-DA03-838DF8CA95FD";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:185]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.5 0.875 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 234 ".uvst[0].uvsp[0:233]" -type "float2" 0.375 0.75 0.625
		 0.75 0.375 1 0.625 1 0.5 1 0.5 0.75 0.375 0.96428573 0.5 0.96428573 0.625 0.96428573
		 0.375 0.9285714 0.5 0.9285714 0.625 0.9285714 0.375 0.89285713 0.5 0.89285713 0.625
		 0.89285713 0.375 0.85714287 0.5 0.85714287 0.625 0.85714287 0.375 0.8214286 0.5 0.8214286
		 0.625 0.8214286 0.375 0.78571427 0.5 0.78571427 0.625 0.78571427 0.375 0.96428573
		 0.5 0.96428573 0.5 1 0.375 1 0.5 1 0.5 0.96428573 0.625 0.96428573 0.625 1 0.375
		 0.9285714 0.5 0.9285714 0.5 0.96428573 0.375 0.96428573 0.625 0.96428573 0.5 0.96428573
		 0.5 0.9285714 0.625 0.9285714 0.375 0.89285713 0.5 0.89285713 0.5 0.9285714 0.375
		 0.9285714 0.625 0.9285714 0.5 0.9285714 0.5 0.89285713 0.625 0.89285713 0.375 0.85714287
		 0.5 0.85714287 0.5 0.89285713 0.375 0.89285713 0.625 0.89285713 0.5 0.89285713 0.5
		 0.85714287 0.625 0.85714287 0.375 0.8214286 0.5 0.8214286 0.5 0.85714287 0.375 0.85714287
		 0.625 0.85714287 0.5 0.85714287 0.5 0.8214286 0.625 0.8214286 0.375 0.78571427 0.5
		 0.78571427 0.5 0.8214286 0.375 0.8214286 0.625 0.8214286 0.5 0.8214286 0.5 0.78571427
		 0.625 0.78571427 0.375 0.75 0.5 0.75 0.5 0.78571427 0.375 0.78571427 0.625 0.78571427
		 0.5 0.78571427 0.5 0.75 0.625 0.75 0.375 0.96428573 0.5 0.96428573 0.5 0.96428573
		 0.375 0.96428573 0.5 1 0.5 1 0.375 1 0.375 1 0.5 0.96428573 0.5 1 0.625 0.96428573
		 0.625 0.96428573 0.625 1 0.625 1 0.375 0.9285714 0.5 0.9285714 0.5 0.9285714 0.375
		 0.9285714 0.5 0.96428573 0.375 0.96428573 0.5 0.96428573 0.625 0.96428573 0.5 0.9285714
		 0.625 0.9285714 0.625 0.9285714 0.375 0.89285713 0.5 0.89285713 0.5 0.89285713 0.375
		 0.89285713 0.5 0.9285714 0.375 0.9285714 0.5 0.9285714 0.625 0.9285714 0.5 0.89285713
		 0.625 0.89285713 0.625 0.89285713 0.375 0.85714287 0.5 0.85714287 0.5 0.85714287
		 0.375 0.85714287 0.5 0.89285713 0.375 0.89285713 0.5 0.89285713 0.625 0.89285713
		 0.5 0.85714287 0.625 0.85714287 0.625 0.85714287 0.375 0.8214286 0.5 0.8214286 0.5
		 0.8214286 0.375 0.8214286 0.5 0.85714287 0.375 0.85714287 0.5 0.85714287 0.625 0.85714287
		 0.5 0.8214286 0.625 0.8214286 0.625 0.8214286 0.375 0.78571427 0.5 0.78571427 0.5
		 0.78571427 0.375 0.78571427 0.5 0.8214286 0.375 0.8214286 0.5 0.8214286 0.625 0.8214286
		 0.5 0.78571427 0.625 0.78571427 0.625 0.78571427 0.375 0.75 0.5 0.75 0.5 0.75 0.375
		 0.75 0.5 0.78571427 0.375 0.78571427 0.5 0.78571427 0.625 0.78571427 0.5 0.75 0.625
		 0.75 0.625 0.75 0.5 0.96428573 0.375 0.96428573 0.5 1 0.5 1 0.375 1 0.375 1 0.375
		 0.96428573 0.5 0.96428573 0.5 1 0.625 0.96428573 0.625 0.96428573 0.625 1 0.625 1
		 0.5 0.9285714 0.375 0.9285714 0.5 0.96428573 0.375 0.96428573 0.375 0.9285714 0.5
		 0.96428573 0.625 0.96428573 0.5 0.9285714 0.625 0.9285714 0.625 0.9285714 0.5 0.89285713
		 0.375 0.89285713 0.5 0.9285714 0.375 0.9285714 0.375 0.89285713 0.5 0.9285714 0.625
		 0.9285714 0.5 0.89285713 0.625 0.89285713 0.625 0.89285713 0.5 0.85714287 0.375 0.85714287
		 0.5 0.89285713 0.375 0.89285713 0.375 0.85714287 0.5 0.89285713 0.625 0.89285713
		 0.5 0.85714287 0.625 0.85714287 0.625 0.85714287 0.5 0.8214286 0.375 0.8214286 0.5
		 0.85714287 0.375 0.85714287 0.375 0.8214286 0.5 0.85714287 0.625 0.85714287 0.5 0.8214286
		 0.625 0.8214286 0.625 0.8214286 0.5 0.78571427 0.375 0.78571427 0.5 0.8214286 0.375
		 0.8214286 0.375 0.78571427 0.5 0.8214286 0.625 0.8214286 0.5 0.78571427 0.625 0.78571427
		 0.625 0.78571427 0.375 0.75 0.5 0.75 0.5 0.75 0.375 0.75 0.5 0.78571427 0.375 0.78571427
		 0.5 0.78571427 0.625 0.78571427 0.5 0.75 0.625 0.75 0.625 0.75;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 160 ".vt[0:159]"  -396.5 0 942 50 0 942 -396.5 0 -50 50 0 -50
		 -173.25 0 942 -173.25 0 -50 -396.5 0 800.28588867 -173.25 0 800.28588867 50 0 800.28588867
		 -396.5 0 658.57128906 -173.25 0 658.57128906 50 0 658.57128906 -396.5 0 516.85705566
		 -173.25 0 516.85705566 50 0 516.85705566 -396.5 0 375.14279175 -173.25 0 375.14279175
		 50 0 375.14279175 -396.5 0 233.4286499 -173.25 0 233.4286499 50 0 233.4286499 -396.5 0 91.71432495
		 -173.25 0 91.71432495 50 0 91.71432495 -391.5 0 805.28588867 -178.25 0 805.28588867
		 -178.25 0 937 -391.5 0 937 -168.25 0 805.28588867 -168.25 0 937 45 0 805.28588867
		 45 0 937 -391.5 0 663.57128906 -178.25 0 663.57128906 -178.25 0 795.28588867 -391.5 0 795.28588867
		 -168.25 0 795.28588867 45 0 795.28588867 -168.25 0 663.57128906 45 0 663.57128906
		 -391.5 0 521.85705566 -178.25 0 521.85705566 -178.25 0 653.57128906 -391.5 0 653.57128906
		 -168.25 0 653.57128906 45 0 653.57128906 -168.25 0 521.85705566 45 0 521.85705566
		 -391.5 0 380.14279175 -178.25 0 380.14279175 -178.25 0 511.85705566 -391.5 0 511.85705566
		 -168.25 0 511.85705566 45 0 511.85705566 -168.25 0 380.14279175 45 0 380.14279175
		 -391.5 0 238.4286499 -178.25 0 238.4286499 -178.25 0 370.14279175 -391.5 0 370.14279175
		 -168.25 0 370.14279175 45 0 370.14279175 -168.25 0 238.4286499 45 0 238.4286499 -391.5 0 96.71432495
		 -178.25 0 96.71432495 -178.25 0 228.4286499 -391.5 0 228.4286499 -168.25 0 228.4286499
		 45 0 228.4286499 -168.25 0 96.71432495 45 0 96.71432495 -391.5 0 -45 -178.25 0 -45
		 -178.25 0 86.71432495 -391.5 0 86.71432495 -168.25 0 86.71432495 45 0 86.71432495
		 -168.25 0 -45 45 0 -45 -396.5 100 800.28588867 -173.25 100 800.28588867 -178.25 100 805.28588867
		 -391.5 100 805.28588867 -173.25 100 942 -178.25 100 937 -396.5 100 942 -391.5 100 937
		 -168.25 100 805.28588867 -168.25 100 937 50 100 800.28588867 45 100 805.28588867
		 50 100 942 45 100 937 -396.5 100 658.57128906 -173.25 100 658.57128906 -178.25 100 663.57128906
		 -391.5 100 663.57128906 -178.25 100 795.28588867 -391.5 100 795.28588867 -168.25 100 795.28588867
		 45 100 795.28588867 -168.25 100 663.57128906 50 100 658.57128906 45 100 663.57128906
		 -396.5 100 516.85705566 -173.25 100 516.85705566 -178.25 100 521.85705566 -391.5 100 521.85705566
		 -178.25 100 653.57128906 -391.5 100 653.57128906 -168.25 100 653.57128906 45 100 653.57128906
		 -168.25 100 521.85705566 50 100 516.85705566 45 100 521.85705566 -396.5 100 375.14279175
		 -173.25 100 375.14279175 -178.25 100 380.14279175 -391.5 100 380.14279175 -178.25 100 511.85705566
		 -391.5 100 511.85705566 -168.25 100 511.85705566 45 100 511.85705566 -168.25 100 380.14279175
		 50 100 375.14279175 45 100 380.14279175 -396.5 100 233.4286499 -173.25 100 233.42863464
		 -178.25 100 238.42866516 -391.5 100 238.4286499 -178.25 100 370.14279175 -391.5 100 370.14279175
		 -168.25 100 370.14279175 45 100 370.14279175 -168.25 100 238.4286499 50 100 233.4286499
		 45 100 238.42866516 -396.5 100 91.71432495 -173.25 100 91.71432495 -178.25 100 96.71432495
		 -391.5 100 96.71432495 -178.25 100 228.4286499 -391.5 100 228.42863464 -168.25 100 228.42863464
		 45 100 228.4286499 -168.25 100 96.71432495 50 100 91.71432495 45 100 96.71432495
		 -396.5 100 -50 -173.25 100 -50 -178.25 100 -45 -391.5 100 -45 -178.25 100 86.71432495
		 -391.5 100 86.71432495 -168.25 100 86.71432495 45 100 86.71432495 -168.25 100 -45
		 50 100 -50 45 100 -45;
	setAttr -s 372 ".ed";
	setAttr ".ed[0:165]"  0 4 0 2 5 0 2 21 0 3 23 0 4 1 0 5 3 0 5 22 1 6 0 0
		 7 4 1 8 1 0 6 7 1 7 8 1 9 6 0 10 7 1 11 8 0 9 10 1 10 11 1 12 9 0 13 10 1 14 11 0
		 12 13 1 13 14 1 15 12 0 16 13 1 17 14 0 15 16 1 16 17 1 18 15 0 19 16 1 20 17 0 18 19 1
		 19 20 1 21 18 0 22 19 1 23 20 0 21 22 1 22 23 1 6 24 0 7 25 0 24 25 0 4 26 0 25 26 0
		 0 27 0 27 26 0 24 27 0 7 28 0 4 29 0 28 29 0 8 30 0 28 30 0 1 31 0 30 31 0 29 31 0
		 9 32 0 10 33 0 32 33 0 7 34 0 33 34 0 6 35 0 35 34 0 32 35 0 7 36 0 8 37 1 36 37 0
		 10 38 1 38 36 0 11 39 1 38 39 0 39 37 0 12 40 1 13 41 1 40 41 0 10 42 1 41 42 0 9 43 1
		 43 42 0 40 43 0 10 44 1 11 45 1 44 45 0 13 46 1 46 44 0 14 47 1 46 47 0 47 45 0 15 48 1
		 16 49 1 48 49 0 13 50 1 49 50 0 12 51 1 51 50 0 48 51 0 13 52 1 14 53 1 52 53 0 16 54 1
		 54 52 0 17 55 1 54 55 0 55 53 0 18 56 1 19 57 1 56 57 0 16 58 1 57 58 0 15 59 1 59 58 0
		 56 59 0 16 60 1 17 61 1 60 61 0 19 62 1 62 60 0 20 63 1 62 63 0 63 61 0 21 64 1 22 65 1
		 64 65 0 19 66 1 65 66 0 18 67 1 67 66 0 64 67 0 19 68 1 20 69 1 68 69 0 22 70 1 70 68 0
		 23 71 1 70 71 0 71 69 0 2 72 1 5 73 1 72 73 0 22 74 1 73 74 0 21 75 1 75 74 0 72 75 0
		 22 76 1 23 77 1 76 77 0 5 78 1 78 76 0 3 79 1 78 79 0 79 77 0 6 80 1 80 81 1 25 82 0
		 81 82 0 24 83 0 83 82 0 80 83 0 4 84 1 81 84 1 26 85 0 84 85 0 82 85 0 0 86 0 86 84 0
		 27 87 0 86 87 0 87 85 0;
	setAttr ".ed[166:331]" 80 86 0 83 87 0 28 88 0 81 88 0 29 89 0 88 89 0 84 89 0
		 8 90 1 81 90 1 30 91 0 90 91 0 88 91 0 1 92 0 90 92 0 31 93 0 92 93 0 91 93 0 84 92 0
		 89 93 0 9 94 1 94 95 1 33 96 0 95 96 0 32 97 0 97 96 0 94 97 0 95 81 1 34 98 0 81 98 0
		 96 98 0 35 99 0 80 99 0 99 98 0 94 80 0 97 99 0 36 100 0 81 100 0 37 101 0 100 101 0
		 90 101 1 38 102 0 95 102 1 102 100 0 11 103 1 95 103 1 39 104 0 103 104 1 102 104 0
		 103 90 0 104 101 0 12 105 1 105 106 1 41 107 0 106 107 1 40 108 0 108 107 0 105 108 1
		 106 95 1 42 109 0 95 109 1 107 109 0 43 110 0 94 110 1 110 109 0 105 94 0 108 110 0
		 44 111 0 95 111 1 45 112 0 111 112 0 103 112 1 46 113 0 106 113 1 113 111 0 14 114 1
		 106 114 1 47 115 0 114 115 1 113 115 0 114 103 0 115 112 0 15 116 1 116 117 1 49 118 0
		 117 118 1 48 119 0 119 118 0 116 119 1 117 106 1 50 120 0 106 120 1 118 120 0 51 121 0
		 105 121 1 121 120 0 116 105 0 119 121 0 52 122 0 106 122 1 53 123 0 122 123 0 114 123 1
		 54 124 0 117 124 1 124 122 0 17 125 1 117 125 1 55 126 0 125 126 1 124 126 0 125 114 0
		 126 123 0 18 127 1 127 128 1 57 129 0 128 129 1 56 130 0 130 129 0 127 130 1 128 117 1
		 58 131 0 117 131 1 129 131 0 59 132 0 116 132 1 132 131 0 127 116 0 130 132 0 60 133 0
		 117 133 1 61 134 0 133 134 0 125 134 1 62 135 0 128 135 1 135 133 0 20 136 1 128 136 1
		 63 137 0 136 137 1 135 137 0 136 125 0 137 134 0 21 138 1 138 139 1 65 140 0 139 140 1
		 64 141 0 141 140 0 138 141 1 139 128 1 66 142 0 128 142 1 140 142 0 67 143 0 127 143 1
		 143 142 0 138 127 0 141 143 0 68 144 0 128 144 1 69 145 0 144 145 0 136 145 1 70 146 0
		 139 146 1;
	setAttr ".ed[332:371]" 146 144 0 23 147 1 139 147 1 71 148 0 147 148 1 146 148 0
		 147 136 0 148 145 0 2 149 0 5 150 1 149 150 0 73 151 0 150 151 1 72 152 0 152 151 0
		 149 152 1 150 139 1 74 153 0 139 153 1 151 153 0 75 154 0 138 154 1 154 153 0 149 138 0
		 152 154 0 76 155 0 139 155 1 77 156 0 155 156 0 147 156 1 78 157 0 150 157 1 157 155 0
		 3 158 0 150 158 0 79 159 0 158 159 1 157 159 0 158 147 0 159 156 0;
	setAttr -s 186 -ch 744 ".fc[0:185]" -type "polyFaces" 
		f 4 155 154 -153 -151
		mu 0 4 166 161 160 7
		f 4 152 160 -160 -158
		mu 0 4 7 160 162 163
		f 4 159 -166 -165 162
		mu 0 4 163 162 165 164
		f 4 164 -168 -156 166
		mu 0 4 164 165 161 166
		f 4 172 -172 -170 157
		mu 0 4 163 168 167 7
		f 4 169 177 -177 -175
		mu 0 4 7 167 169 170
		f 4 176 182 -182 -180
		mu 0 4 170 169 172 171
		f 4 181 -185 -173 183
		mu 0 4 171 172 168 163
		f 4 191 190 -189 -187
		mu 0 4 177 174 173 10
		f 4 188 195 -195 -193
		mu 0 4 10 173 175 7
		f 4 194 -199 -198 150
		mu 0 4 7 175 176 166
		f 4 197 -201 -192 199
		mu 0 4 166 176 174 177
		f 4 205 -205 -203 174
		mu 0 4 170 179 178 7
		f 4 202 -209 -208 192
		mu 0 4 7 178 180 10
		f 4 207 213 -213 -211
		mu 0 4 10 180 181 182
		f 4 212 215 -206 -215
		mu 0 4 182 181 179 170
		f 4 222 221 -220 -218
		mu 0 4 187 184 183 13
		f 4 219 226 -226 -224
		mu 0 4 13 183 185 10
		f 4 225 -230 -229 186
		mu 0 4 10 185 186 177
		f 4 228 -232 -223 230
		mu 0 4 177 186 184 187
		f 4 236 -236 -234 210
		mu 0 4 182 189 188 10
		f 4 233 -240 -239 223
		mu 0 4 10 188 190 13
		f 4 238 244 -244 -242
		mu 0 4 13 190 191 192
		f 4 243 246 -237 -246
		mu 0 4 192 191 189 182
		f 4 253 252 -251 -249
		mu 0 4 197 194 193 16
		f 4 250 257 -257 -255
		mu 0 4 16 193 195 13
		f 4 256 -261 -260 217
		mu 0 4 13 195 196 187
		f 4 259 -263 -254 261
		mu 0 4 187 196 194 197
		f 4 267 -267 -265 241
		mu 0 4 192 199 198 13
		f 4 264 -271 -270 254
		mu 0 4 13 198 200 16
		f 4 269 275 -275 -273
		mu 0 4 16 200 201 202
		f 4 274 277 -268 -277
		mu 0 4 202 201 199 192
		f 4 284 283 -282 -280
		mu 0 4 207 204 203 19
		f 4 281 288 -288 -286
		mu 0 4 19 203 205 16
		f 4 287 -292 -291 248
		mu 0 4 16 205 206 197
		f 4 290 -294 -285 292
		mu 0 4 197 206 204 207
		f 4 298 -298 -296 272
		mu 0 4 202 209 208 16
		f 4 295 -302 -301 285
		mu 0 4 16 208 210 19
		f 4 300 306 -306 -304
		mu 0 4 19 210 211 212
		f 4 305 308 -299 -308
		mu 0 4 212 211 209 202
		f 4 315 314 -313 -311
		mu 0 4 217 214 213 22
		f 4 312 319 -319 -317
		mu 0 4 22 213 215 19
		f 4 318 -323 -322 279
		mu 0 4 19 215 216 207
		f 4 321 -325 -316 323
		mu 0 4 207 216 214 217
		f 4 329 -329 -327 303
		mu 0 4 212 219 218 19
		f 4 326 -333 -332 316
		mu 0 4 19 218 220 22
		f 4 331 337 -337 -335
		mu 0 4 22 220 221 222
		f 4 336 339 -330 -339
		mu 0 4 222 221 219 212
		f 4 347 346 -345 -343
		mu 0 4 223 226 225 224
		f 4 344 351 -351 -349
		mu 0 4 224 225 227 22
		f 4 350 -355 -354 310
		mu 0 4 22 227 228 217
		f 4 353 -357 -348 355
		mu 0 4 217 228 226 223
		f 4 361 -361 -359 334
		mu 0 4 222 230 229 22
		f 4 358 -365 -364 348
		mu 0 4 22 229 231 224
		f 4 363 369 -369 -367
		mu 0 4 224 231 233 232
		f 4 368 371 -362 -371
		mu 0 4 232 233 230 222
		f 4 10 38 -40 -38
		mu 0 4 80 81 82 83
		f 4 8 40 -42 -39
		mu 0 4 81 84 85 82
		f 4 -1 42 43 -41
		mu 0 4 84 86 87 85
		f 4 -8 37 44 -43
		mu 0 4 86 80 83 87
		f 4 -9 45 47 -47
		mu 0 4 84 81 88 89
		f 4 11 48 -50 -46
		mu 0 4 81 90 91 88
		f 4 9 50 -52 -49
		mu 0 4 90 92 93 91
		f 4 -5 46 52 -51
		mu 0 4 92 84 89 93
		f 4 15 54 -56 -54
		mu 0 4 94 95 96 97
		f 4 13 56 -58 -55
		mu 0 4 95 81 98 96
		f 4 -11 58 59 -57
		mu 0 4 81 80 99 98
		f 4 -13 53 60 -59
		mu 0 4 80 94 97 99
		f 4 -12 61 63 -63
		mu 0 4 90 81 100 101
		f 4 -14 64 65 -62
		mu 0 4 81 95 102 100
		f 4 16 66 -68 -65
		mu 0 4 95 103 104 102
		f 4 14 62 -69 -67
		mu 0 4 103 90 101 104
		f 4 20 70 -72 -70
		mu 0 4 105 106 107 108
		f 4 18 72 -74 -71
		mu 0 4 106 95 109 107
		f 4 -16 74 75 -73
		mu 0 4 95 94 110 109
		f 4 -18 69 76 -75
		mu 0 4 94 105 108 110
		f 4 -17 77 79 -79
		mu 0 4 103 95 111 112
		f 4 -19 80 81 -78
		mu 0 4 95 106 113 111
		f 4 21 82 -84 -81
		mu 0 4 106 114 115 113
		f 4 19 78 -85 -83
		mu 0 4 114 103 112 115
		f 4 25 86 -88 -86
		mu 0 4 116 117 118 119
		f 4 23 88 -90 -87
		mu 0 4 117 106 120 118
		f 4 -21 90 91 -89
		mu 0 4 106 105 121 120
		f 4 -23 85 92 -91
		mu 0 4 105 116 119 121
		f 4 -22 93 95 -95
		mu 0 4 114 106 122 123
		f 4 -24 96 97 -94
		mu 0 4 106 117 124 122
		f 4 26 98 -100 -97
		mu 0 4 117 125 126 124
		f 4 24 94 -101 -99
		mu 0 4 125 114 123 126
		f 4 30 102 -104 -102
		mu 0 4 127 128 129 130
		f 4 28 104 -106 -103
		mu 0 4 128 117 131 129
		f 4 -26 106 107 -105
		mu 0 4 117 116 132 131
		f 4 -28 101 108 -107
		mu 0 4 116 127 130 132
		f 4 -27 109 111 -111
		mu 0 4 125 117 133 134
		f 4 -29 112 113 -110
		mu 0 4 117 128 135 133
		f 4 31 114 -116 -113
		mu 0 4 128 136 137 135
		f 4 29 110 -117 -115
		mu 0 4 136 125 134 137
		f 4 35 118 -120 -118
		mu 0 4 138 139 140 141
		f 4 33 120 -122 -119
		mu 0 4 139 128 142 140
		f 4 -31 122 123 -121
		mu 0 4 128 127 143 142
		f 4 -33 117 124 -123
		mu 0 4 127 138 141 143
		f 4 -32 125 127 -127
		mu 0 4 136 128 144 145
		f 4 -34 128 129 -126
		mu 0 4 128 139 146 144
		f 4 36 130 -132 -129
		mu 0 4 139 147 148 146
		f 4 34 126 -133 -131
		mu 0 4 147 136 145 148
		f 4 1 134 -136 -134
		mu 0 4 149 150 151 152
		f 4 6 136 -138 -135
		mu 0 4 150 139 153 151
		f 4 -36 138 139 -137
		mu 0 4 139 138 154 153
		f 4 -3 133 140 -139
		mu 0 4 138 149 152 154
		f 4 -37 141 143 -143
		mu 0 4 147 139 155 156
		f 4 -7 144 145 -142
		mu 0 4 139 150 157 155
		f 4 5 146 -148 -145
		mu 0 4 150 158 159 157
		f 4 3 142 -149 -147
		mu 0 4 158 147 156 159
		f 4 151 -155 -154 39
		mu 0 4 25 160 161 24
		f 4 158 -161 -152 41
		mu 0 4 26 162 160 25
		f 4 156 -163 -162 0
		mu 0 4 4 163 164 2
		f 4 163 165 -159 -44
		mu 0 4 27 165 162 26
		f 4 161 -167 -150 7
		mu 0 4 2 164 166 6
		f 4 153 167 -164 -45
		mu 0 4 24 161 165 27
		f 4 168 171 -171 -48
		mu 0 4 29 167 168 28
		f 4 175 -178 -169 49
		mu 0 4 30 169 167 29
		f 4 173 179 -179 -10
		mu 0 4 8 170 171 3
		f 4 180 -183 -176 51
		mu 0 4 31 172 169 30
		f 4 178 -184 -157 4
		mu 0 4 3 171 163 4
		f 4 170 184 -181 -53
		mu 0 4 28 168 172 31
		f 4 187 -191 -190 55
		mu 0 4 33 173 174 32
		f 4 193 -196 -188 57
		mu 0 4 34 175 173 33
		f 4 196 198 -194 -60
		mu 0 4 35 176 175 34
		f 4 149 -200 -186 12
		mu 0 4 6 166 177 9
		f 4 189 200 -197 -61
		mu 0 4 32 174 176 35
		f 4 201 204 -204 -64
		mu 0 4 37 178 179 36
		f 4 206 208 -202 -66
		mu 0 4 38 180 178 37
		f 4 211 -214 -207 67
		mu 0 4 39 181 180 38
		f 4 209 214 -174 -15
		mu 0 4 11 182 170 8
		f 4 203 -216 -212 68
		mu 0 4 36 179 181 39
		f 4 218 -222 -221 71
		mu 0 4 41 183 184 40
		f 4 224 -227 -219 73
		mu 0 4 42 185 183 41
		f 4 227 229 -225 -76
		mu 0 4 43 186 185 42
		f 4 185 -231 -217 17
		mu 0 4 9 177 187 12
		f 4 220 231 -228 -77
		mu 0 4 40 184 186 43
		f 4 232 235 -235 -80
		mu 0 4 45 188 189 44
		f 4 237 239 -233 -82
		mu 0 4 46 190 188 45
		f 4 242 -245 -238 83
		mu 0 4 47 191 190 46
		f 4 240 245 -210 -20
		mu 0 4 14 192 182 11
		f 4 234 -247 -243 84
		mu 0 4 44 189 191 47
		f 4 249 -253 -252 87
		mu 0 4 49 193 194 48
		f 4 255 -258 -250 89
		mu 0 4 50 195 193 49
		f 4 258 260 -256 -92
		mu 0 4 51 196 195 50
		f 4 216 -262 -248 22
		mu 0 4 12 187 197 15
		f 4 251 262 -259 -93
		mu 0 4 48 194 196 51
		f 4 263 266 -266 -96
		mu 0 4 53 198 199 52
		f 4 268 270 -264 -98
		mu 0 4 54 200 198 53
		f 4 273 -276 -269 99
		mu 0 4 55 201 200 54
		f 4 271 276 -241 -25
		mu 0 4 17 202 192 14
		f 4 265 -278 -274 100
		mu 0 4 52 199 201 55
		f 4 280 -284 -283 103
		mu 0 4 57 203 204 56
		f 4 286 -289 -281 105
		mu 0 4 58 205 203 57
		f 4 289 291 -287 -108
		mu 0 4 59 206 205 58
		f 4 247 -293 -279 27
		mu 0 4 15 197 207 18
		f 4 282 293 -290 -109
		mu 0 4 56 204 206 59
		f 4 294 297 -297 -112
		mu 0 4 61 208 209 60
		f 4 299 301 -295 -114
		mu 0 4 62 210 208 61
		f 4 304 -307 -300 115
		mu 0 4 63 211 210 62
		f 4 302 307 -272 -30
		mu 0 4 20 212 202 17
		f 4 296 -309 -305 116
		mu 0 4 60 209 211 63
		f 4 311 -315 -314 119
		mu 0 4 65 213 214 64
		f 4 317 -320 -312 121
		mu 0 4 66 215 213 65
		f 4 320 322 -318 -124
		mu 0 4 67 216 215 66
		f 4 278 -324 -310 32
		mu 0 4 18 207 217 21
		f 4 313 324 -321 -125
		mu 0 4 64 214 216 67
		f 4 325 328 -328 -128
		mu 0 4 69 218 219 68
		f 4 330 332 -326 -130
		mu 0 4 70 220 218 69
		f 4 335 -338 -331 131
		mu 0 4 71 221 220 70
		f 4 333 338 -303 -35
		mu 0 4 23 222 212 20
		f 4 327 -340 -336 132
		mu 0 4 68 219 221 71
		f 4 340 342 -342 -2
		mu 0 4 0 223 224 5
		f 4 343 -347 -346 135
		mu 0 4 73 225 226 72
		f 4 349 -352 -344 137
		mu 0 4 74 227 225 73
		f 4 352 354 -350 -140
		mu 0 4 75 228 227 74
		f 4 309 -356 -341 2
		mu 0 4 21 217 223 0
		f 4 345 356 -353 -141
		mu 0 4 72 226 228 75
		f 4 357 360 -360 -144
		mu 0 4 77 229 230 76
		f 4 362 364 -358 -146
		mu 0 4 78 231 229 77
		f 4 341 366 -366 -6
		mu 0 4 5 224 232 1
		f 4 367 -370 -363 147
		mu 0 4 79 233 231 78
		f 4 365 370 -334 -4
		mu 0 4 1 232 222 23
		f 4 359 -372 -368 148
		mu 0 4 76 230 233 79;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface60" -p "group11";
	rename -uid "94A9F3A8-4EBB-B82D-954A-F2AE7D99AE05";
	setAttr ".t" -type "double3" -9.7875213623046875 0 15.869861655541683 ;
	setAttr ".s" -type "double3" 1 1 0.95248544414508485 ;
	setAttr ".rp" -type "double3" 229.78752136230469 100.00025177001952 318.13013834445832 ;
	setAttr ".sp" -type "double3" 229.78752136230469 100.00025177001952 334 ;
	setAttr ".spt" -type "double3" 0 0 -15.86986165554168 ;
createNode mesh -n "polySurfaceShape60" -p "polySurface60";
	rename -uid "3BAF5ADB-4333-94AC-F720-309E1191126D";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0 0.5 1 1 0 1
		 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".pt[0:7]" -type "float3"  3.2875366 -1.8651747e-14 
		820 3.2875366 -2.8421709e-14 820 3.2875366 -2.8421709e-14 670 3.2875366 -1.8651747e-14 
		670 0 0 0 0 0 0 0 0 0 0 0 0;
	setAttr -s 4 ".vt[0:3]"  226.49998474 5 -406 226.49998474 195.00050354004 -406
		 226.49998474 195.00050354004 -331 226.49998474 5 -331;
	setAttr -s 4 ".ed[0:3]"  0 1 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 3 -3 -2
		mu 0 4 0 1 3 2;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape93" -p "polySurface60";
	rename -uid "E8E86826-4B73-74A3-A137-688F4B4B2429";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "e[2:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".pt[0:3]" -type "float3"  435 0 0 435 0 0 435 -39.999496 
		0 435 -39.999496 0;
	setAttr -s 4 ".vt[0:3]"  -208.5 1.4210855e-14 -496 -208.5 1.4210855e-14 -326
		 -208.5 240 -496 -208.5 240 -326;
	setAttr -s 4 ".ed[0:3]"  2 0 0 3 1 0 0 1 0 2 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 3 1 -3 -1
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape94" -p "polySurface60";
	rename -uid "BB583938-4FF9-779E-09F6-F9A3D496B52B";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr ".pv" -type "double2" 0.75 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 8 ".uvst[0].uvsp[0:7]" -type "float2" 0.5 1 0.5 0 0.5 0
		 0.5 1 1 0 1 0 1 1 1 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 8 ".vt[0:7]"  226.5 1.4210855e-14 -326 226.5 200.00050354004 -326
		 226.5 1.4210855e-14 -411 226.5 200.00050354004 -411 226.5 5 -406 226.5 195.00050354004 -406
		 226.5 195.00050354004 -331 226.5 5 -331;
	setAttr -s 12 ".ed[0:11]"  1 0 0 2 0 0 3 1 0 2 3 0 2 4 1 3 5 1 4 5 0
		 1 6 1 5 6 0 0 7 1 6 7 0 4 7 0;
	setAttr -s 4 -ch 16 ".fc[0:3]" -type "polyFaces" 
		f 4 3 5 -7 -5
		mu 0 4 0 1 2 3
		f 4 2 7 -9 -6
		mu 0 4 1 4 5 2
		f 4 0 9 -11 -8
		mu 0 4 4 6 7 5
		f 4 -2 4 11 -10
		mu 0 4 6 0 3 7;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface41" -p "group11";
	rename -uid "5D6AAA67-4EB7-B796-792E-B5870CC73190";
	setAttr ".t" -type "double3" 935.56289602049731 -1056.5602317509454 15.229155791538005 ;
	setAttr ".r" -type "double3" 90 0 90 ;
	setAttr ".s" -type "double3" 1 1.657491075826123 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -3.0662759821607684 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -653.57562637329102 820.63313999583261 -167.05751362254162 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.2163257610819214 0 ;
createNode mesh -n "polySurfaceShape41" -p "polySurface41";
	rename -uid "54D97619-4049-20CF-4634-148AFFCA784D";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape71" -p "polySurface41";
	rename -uid "E869DD90-40C8-D8CA-0E18-0F9995E3DD28";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface33" -p "group11";
	rename -uid "835D9A95-4D9A-2AFA-DCAC-CD9A13600211";
	setAttr ".t" -type "double3" 110.84387306261328 -94.160206236989069 -0.46006968453630748 ;
	setAttr ".r" -type "double3" 0 0 90.000000000000028 ;
	setAttr ".s" -type "double3" 1 1.156026150118346 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -1.8499502210788688 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -7.4000228376219184 -7.4000228376215773 0 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.4543921622589551e-14 0 ;
createNode mesh -n "polySurfaceShape33" -p "polySurface33";
	rename -uid "BCF6B414-42FD-A27D-463A-36BBD6D08D8A";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape66" -p "polySurface33";
	rename -uid "173CA1EF-4EAA-9DA8-554E-C38840A0FD68";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pCube1_1M_Ref6" -p "group11";
	rename -uid "E361BB2A-425A-8C85-377F-DEBAC7D11A19";
	setAttr ".t" -type "double3" 170 208.00050354003906 -446 ;
	setAttr ".s" -type "double3" 1 0.08 1 ;
	setAttr ".rp" -type "double3" 50 0 -50 ;
	setAttr ".sp" -type "double3" 50 0 -50 ;
createNode mesh -n "pCube1_1M_Ref6Shape" -p "pCube1_1M_Ref6";
	rename -uid "1BF7FF5E-4C58-506F-4E7D-8E8388C6D6AF";
	setAttr -k off ".v";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 1 "f[0:101]";
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.5 0.87499994039535522 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 204 ".uvst[0].uvsp[0:203]" -type "float2" 0.375 0.75 0.625
		 0.75 0.375 1 0.625 1 0.38257575 1 0.38257575 0.75 0.3901515 1 0.3901515 0.75 0.39772725
		 1 0.39772725 0.75 0.405303 1 0.405303 0.75 0.41287878 1 0.41287878 0.75 0.42045456
		 1 0.42045456 0.75 0.42803031 1 0.42803031 0.74999994 0.43560606 1 0.43560606 0.74999994
		 0.44318181 1 0.44318181 0.74999988 0.45075759 1 0.45075759 0.74999988 0.45833334
		 1 0.45833334 0.74999988 0.46590909 1 0.46590909 0.74999988 0.47348484 1 0.47348484
		 0.74999994 0.48106059 1 0.48106059 0.74999994 0.48863634 1 0.48863634 0.74999994
		 0.4962121 1 0.4962121 0.74999994 0.50378788 1 0.50378788 0.74999994 0.51136363 1
		 0.51136363 0.74999994 0.51893938 1 0.51893938 0.74999994 0.52651513 1 0.52651513
		 0.74999994 0.53409088 1 0.53409088 0.74999994 0.54166663 1 0.54166663 0.74999994
		 0.54924238 1 0.54924238 0.74999994 0.55681813 1 0.55681813 0.74999994 0.56439388
		 1 0.56439388 0.74999994 0.57196963 1 0.57196963 0.74999994 0.57954538 1 0.57954538
		 0.74999994 0.58712119 1 0.58712119 0.74999994 0.594697 1 0.594697 0.75 0.60227275
		 1 0.60227275 0.75 0.6098485 1 0.6098485 0.75 0.61742425 1 0.61742425 0.75 0.61742425
		 1 0.61742425 0.75 0.625 0.75 0.625 1 0.375 0.75 0.38257575 0.75 0.38257575 1 0.375
		 1 0.3901515 1 0.3901515 0.75 0.39772725 0.75 0.39772725 1 0.405303 1 0.405303 0.75
		 0.41287878 0.75 0.41287878 1 0.42045456 1 0.42045456 0.75 0.42803031 0.74999994 0.42803031
		 1 0.43560606 1 0.43560606 0.74999994 0.44318181 0.74999988 0.44318181 1 0.45075759
		 1 0.45075759 0.74999988 0.45833334 0.74999988 0.45833334 1 0.46590909 1 0.46590909
		 0.74999988 0.47348484 0.74999994 0.47348484 1 0.48106059 1 0.48106059 0.74999994
		 0.48863634 0.74999994 0.48863634 1 0.4962121 1 0.4962121 0.74999994 0.50378788 0.74999994
		 0.50378788 1 0.51136363 1 0.51136363 0.74999994 0.51893938 0.74999994 0.51893938
		 1 0.52651513 1 0.52651513 0.74999994 0.53409088 0.74999994 0.53409088 1 0.54166663
		 1 0.54166663 0.74999994 0.54924238 0.74999994 0.54924238 1 0.55681813 1 0.55681813
		 0.74999994 0.56439388 0.74999994 0.56439388 1 0.57196963 1 0.57196963 0.74999994
		 0.57954538 0.74999994 0.57954538 1 0.58712119 1 0.58712119 0.74999994 0.594697 0.75
		 0.594697 1 0.60227275 1 0.60227275 0.75 0.6098485 0.75 0.6098485 1 0.61742425 1 0.61742425
		 0.75 0.625 0.75 0.625 1 0.375 0.75 0.38257575 0.75 0.38257575 1 0.375 1 0.3901515
		 1 0.3901515 0.75 0.39772725 0.75 0.39772725 1 0.405303 1 0.405303 0.75 0.41287878
		 0.75 0.41287878 1 0.42045456 1 0.42045456 0.75 0.42803031 0.74999994 0.42803031 1
		 0.43560606 1 0.43560606 0.74999994 0.44318181 0.74999988 0.44318181 1 0.45075759
		 1 0.45075759 0.74999988 0.45833334 0.74999988 0.45833334 1 0.46590909 1 0.46590909
		 0.74999988 0.47348484 0.74999994 0.47348484 1 0.48106059 1 0.48106059 0.74999994
		 0.48863634 0.74999994 0.48863634 1 0.4962121 1 0.4962121 0.74999994 0.50378788 0.74999994
		 0.50378788 1 0.51136363 1 0.51136363 0.74999994 0.51893938 0.74999994 0.51893938
		 1 0.52651513 1 0.52651513 0.74999994 0.53409088 0.74999994 0.53409088 1 0.54166663
		 1 0.54166663 0.74999994 0.54924238 0.74999994 0.54924238 1 0.55681813 1 0.55681813
		 0.74999994 0.56439388 0.74999994 0.56439388 1 0.57196963 1 0.57196963 0.74999994
		 0.57954538 0.74999994 0.57954538 1 0.58712119 1 0.58712119 0.74999994 0.594697 0.75
		 0.594697 1 0.60227275 1 0.60227275 0.75 0.6098485 0.75 0.6098485 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 136 ".vt[0:135]"  -396.5 0 942 50 0 942 -396.5 0 -50 50 0 -50
		 -382.96972656 0 942 -382.96972656 0 -50 -369.43942261 0 942 -369.43942261 0 -50 -355.90908813 0 942
		 -355.90908813 0 -50 -342.3788147 0 942 -342.3788147 0 -50 -328.84848022 0 942 -328.84848022 0 -50
		 -315.31820679 0 942.000061035156 -315.31820679 0 -50 -301.78793335 0 942.000061035156
		 -301.78793335 0 -50 -288.25765991 0 942.000061035156 -288.25765991 0 -50 -274.72735596 0 942.000061035156
		 -274.72735596 0 -50 -261.19702148 0 942.00012207031 -261.19702148 0 -50 -247.66670227 0 942.00012207031
		 -247.66670227 0 -50 -234.13641357 0 942.000061035156 -234.13641357 0 -50 -220.60612488 0 942.000061035156
		 -220.60612488 0 -50 -207.075820923 0 942 -207.075820923 0 -50 -193.54550171 0 942
		 -193.54550171 0 -50 -180.015182495 0 942 -180.015182495 0 -50 -166.48487854 0 942
		 -166.48487854 0 -50 -152.95457458 0 942 -152.95457458 0 -50 -139.42427063 0 942 -139.42427063 0 -50
		 -125.89396667 0 942 -125.89396667 0 -50 -112.36365509 0 941.99993896 -112.36365509 0 -50
		 -98.83335876 0 941.99987793 -98.83335876 0 -50 -85.30304718 0 941.99981689 -85.30304718 0 -50
		 -71.77274323 0 941.99981689 -71.77274323 0 -50 -58.24245453 0 941.99987793 -58.24245453 0 -50
		 -44.71214294 0 941.99987793 -44.71214294 0 -50 -31.18185425 0 941.99987793 -31.18185425 0 -50
		 -17.65151978 0 941.99987793 -17.65151978 0 -50 -4.12121582 0 941.99993896 -4.12121582 0 -50
		 9.40908813 0 941.99993896 9.40908813 0 -50 22.93937683 0 941.99987793 22.93937683 0 -50
		 36.46969604 0 941.99993896 36.46969604 0 -50 47.76580811 100 941.99993896 47.76580811 100 -50
		 61.29611206 100 -50 61.29611206 100 942 -385.20388794 100 -50 -371.6736145 100 -50
		 -371.6736145 100 942 -385.20388794 100 942 -358.14331055 100 942 -358.14331055 100 -50
		 -344.61297607 100 -50 -344.61297607 100 942 -331.082702637 100 942 -331.082702637 100 -50
		 -317.55236816 100 -50 -317.55236816 100 942 -304.022094727 100 942.000061035156 -304.022094727 100 -50
		 -290.49182129 100 -50 -290.49182129 100 942.000061035156 -276.96154785 100 942.000061035156
		 -276.96154785 100 -50 -263.4312439 100 -50 -263.4312439 100 942.000061035156 -249.90090942 100 942.00012207031
		 -249.90090942 100 -50 -236.37059021 100 -50 -236.37059021 100 942.00012207031 -222.84030151 100 942.000061035156
		 -222.84030151 100 -50 -209.30999756 100 -50 -209.30999756 100 942.000061035156 -195.7796936 100 942
		 -195.7796936 100 -50 -182.24938965 100 -50 -182.24938965 100 942 -168.71905518 100 942
		 -168.71905518 100 -50 -155.18875122 100 -50 -155.18875122 100 942 -141.65844727 100 942
		 -141.65844727 100 -50 -128.12814331 100 -50 -128.12814331 100 942 -114.59784698 100 942
		 -114.59784698 100 -50 -101.0675354 100 -50 -101.0675354 100 941.99993896 -87.5372467 100 941.99987793
		 -87.5372467 100 -50 -74.0069351196 100 -50 -74.0069351196 100 941.99981689 -60.47663116 100 941.99981689
		 -60.47663116 100 -50 -46.94634247 100 -50 -46.94634247 100 941.99987793 -33.41603088 100 941.99987793
		 -33.41603088 100 -50 -19.88574219 100 -50 -19.88574219 100 941.99987793 -6.35540771 100 941.99987793
		 -6.35540771 100 -50 7.17489624 100 -50 7.17489624 100 941.99993896 20.7052002 100 941.99993896
		 20.7052002 100 -50 34.23548889 100 -50 34.23548889 100 941.99987793;
	setAttr -s 204 ".ed";
	setAttr ".ed[0:165]"  0 4 0 2 5 0 2 0 0 3 1 0 4 5 0 6 8 0 7 9 0 6 7 0 8 9 0
		 10 12 0 11 13 0 10 11 0 12 13 0 14 16 0 15 17 0 14 15 0 16 17 0 18 20 0 19 21 0 18 19 0
		 20 21 0 22 24 0 23 25 0 22 23 0 24 25 0 26 28 0 27 29 0 26 27 0 28 29 0 30 32 0 31 33 0
		 30 31 0 32 33 0 34 36 0 35 37 0 34 35 0 36 37 0 38 40 0 39 41 0 38 39 0 40 41 0 42 44 0
		 43 45 0 42 43 0 44 45 0 46 48 0 47 49 0 46 47 0 48 49 0 50 52 0 51 53 0 50 51 0 52 53 0
		 54 56 0 55 57 0 54 55 0 56 57 0 58 60 0 59 61 0 58 59 0 60 61 0 62 64 0 63 65 0 62 63 0
		 64 65 0 66 1 0 67 3 0 66 67 0 66 68 0 67 69 0 68 69 0 3 70 0 69 70 0 1 71 0 70 71 0
		 68 71 0 2 72 0 5 73 0 72 73 0 4 74 0 74 73 0 0 75 0 75 74 0 72 75 0 6 76 0 7 77 0
		 76 77 0 9 78 0 77 78 0 8 79 0 79 78 0 76 79 0 10 80 0 11 81 0 80 81 0 13 82 0 81 82 0
		 12 83 0 83 82 0 80 83 0 14 84 0 15 85 0 84 85 0 17 86 0 85 86 0 16 87 0 87 86 0 84 87 0
		 18 88 0 19 89 0 88 89 0 21 90 0 89 90 0 20 91 0 91 90 0 88 91 0 22 92 0 23 93 0 92 93 0
		 25 94 0 93 94 0 24 95 0 95 94 0 92 95 0 26 96 0 27 97 0 96 97 0 29 98 0 97 98 0 28 99 0
		 99 98 0 96 99 0 30 100 0 31 101 0 100 101 0 33 102 0 101 102 0 32 103 0 103 102 0
		 100 103 0 34 104 0 35 105 0 104 105 0 37 106 0 105 106 0 36 107 0 107 106 0 104 107 0
		 38 108 0 39 109 0 108 109 0 41 110 0 109 110 0 40 111 0 111 110 0 108 111 0 42 112 0
		 43 113 0 112 113 0 45 114 0 113 114 0 44 115 0 115 114 0 112 115 0 46 116 0 47 117 0;
	setAttr ".ed[166:203]" 116 117 0 49 118 0 117 118 0 48 119 0 119 118 0 116 119 0
		 50 120 0 51 121 0 120 121 0 53 122 0 121 122 0 52 123 0 123 122 0 120 123 0 54 124 0
		 55 125 0 124 125 0 57 126 0 125 126 0 56 127 0 127 126 0 124 127 0 58 128 0 59 129 0
		 128 129 0 61 130 0 129 130 0 60 131 0 131 130 0 128 131 0 62 132 0 63 133 0 132 133 0
		 65 134 0 133 134 0 64 135 0 135 134 0 132 135 0;
	setAttr -s 102 -ch 408 ".fc[0:101]" -type "polyFaces" 
		f 4 75 -75 -73 -71
		mu 0 4 136 139 138 137
		f 4 83 82 80 -79
		mu 0 4 140 143 142 141
		f 4 91 90 -89 -87
		mu 0 4 144 147 146 145
		f 4 99 98 -97 -95
		mu 0 4 148 151 150 149
		f 4 107 106 -105 -103
		mu 0 4 152 155 154 153
		f 4 115 114 -113 -111
		mu 0 4 156 159 158 157
		f 4 123 122 -121 -119
		mu 0 4 160 163 162 161
		f 4 131 130 -129 -127
		mu 0 4 164 167 166 165
		f 4 139 138 -137 -135
		mu 0 4 168 171 170 169
		f 4 147 146 -145 -143
		mu 0 4 172 175 174 173
		f 4 155 154 -153 -151
		mu 0 4 176 179 178 177
		f 4 163 162 -161 -159
		mu 0 4 180 183 182 181
		f 4 171 170 -169 -167
		mu 0 4 184 187 186 185
		f 4 179 178 -177 -175
		mu 0 4 188 191 190 189
		f 4 187 186 -185 -183
		mu 0 4 192 195 194 193
		f 4 195 194 -193 -191
		mu 0 4 196 199 198 197
		f 4 203 202 -201 -199
		mu 0 4 200 203 202 201
		f 4 67 66 3 -66
		mu 0 4 68 69 70 71
		f 4 1 -5 -1 -3
		mu 0 4 72 73 74 75
		f 4 7 6 -9 -6
		mu 0 4 76 77 78 79
		f 4 11 10 -13 -10
		mu 0 4 80 81 82 83
		f 4 15 14 -17 -14
		mu 0 4 84 85 86 87
		f 4 19 18 -21 -18
		mu 0 4 88 89 90 91
		f 4 23 22 -25 -22
		mu 0 4 92 93 94 95
		f 4 27 26 -29 -26
		mu 0 4 96 97 98 99
		f 4 31 30 -33 -30
		mu 0 4 100 101 102 103
		f 4 35 34 -37 -34
		mu 0 4 104 105 106 107
		f 4 39 38 -41 -38
		mu 0 4 108 109 110 111
		f 4 43 42 -45 -42
		mu 0 4 112 113 114 115
		f 4 47 46 -49 -46
		mu 0 4 116 117 118 119
		f 4 51 50 -53 -50
		mu 0 4 120 121 122 123
		f 4 55 54 -57 -54
		mu 0 4 124 125 126 127
		f 4 59 58 -61 -58
		mu 0 4 128 129 130 131
		f 4 63 62 -65 -62
		mu 0 4 132 133 134 135
		f 4 68 70 -70 -68
		mu 0 4 66 136 137 67
		f 4 69 72 -72 -67
		mu 0 4 67 137 138 1
		f 4 71 74 -74 -4
		mu 0 4 1 138 139 3
		f 4 73 -76 -69 65
		mu 0 4 3 139 136 66
		f 4 76 78 -78 -2
		mu 0 4 0 140 141 5
		f 4 77 -81 -80 4
		mu 0 4 5 141 142 4
		f 4 79 -83 -82 0
		mu 0 4 4 142 143 2
		f 4 81 -84 -77 2
		mu 0 4 2 143 140 0
		f 4 84 86 -86 -8
		mu 0 4 6 144 145 7
		f 4 85 88 -88 -7
		mu 0 4 7 145 146 9
		f 4 87 -91 -90 8
		mu 0 4 9 146 147 8
		f 4 89 -92 -85 5
		mu 0 4 8 147 144 6
		f 4 92 94 -94 -12
		mu 0 4 10 148 149 11
		f 4 93 96 -96 -11
		mu 0 4 11 149 150 13
		f 4 95 -99 -98 12
		mu 0 4 13 150 151 12
		f 4 97 -100 -93 9
		mu 0 4 12 151 148 10
		f 4 100 102 -102 -16
		mu 0 4 14 152 153 15
		f 4 101 104 -104 -15
		mu 0 4 15 153 154 17
		f 4 103 -107 -106 16
		mu 0 4 17 154 155 16
		f 4 105 -108 -101 13
		mu 0 4 16 155 152 14
		f 4 108 110 -110 -20
		mu 0 4 18 156 157 19
		f 4 109 112 -112 -19
		mu 0 4 19 157 158 21
		f 4 111 -115 -114 20
		mu 0 4 21 158 159 20
		f 4 113 -116 -109 17
		mu 0 4 20 159 156 18
		f 4 116 118 -118 -24
		mu 0 4 22 160 161 23
		f 4 117 120 -120 -23
		mu 0 4 23 161 162 25
		f 4 119 -123 -122 24
		mu 0 4 25 162 163 24
		f 4 121 -124 -117 21
		mu 0 4 24 163 160 22
		f 4 124 126 -126 -28
		mu 0 4 26 164 165 27
		f 4 125 128 -128 -27
		mu 0 4 27 165 166 29
		f 4 127 -131 -130 28
		mu 0 4 29 166 167 28
		f 4 129 -132 -125 25
		mu 0 4 28 167 164 26
		f 4 132 134 -134 -32
		mu 0 4 30 168 169 31
		f 4 133 136 -136 -31
		mu 0 4 31 169 170 33
		f 4 135 -139 -138 32
		mu 0 4 33 170 171 32
		f 4 137 -140 -133 29
		mu 0 4 32 171 168 30
		f 4 140 142 -142 -36
		mu 0 4 34 172 173 35
		f 4 141 144 -144 -35
		mu 0 4 35 173 174 37
		f 4 143 -147 -146 36
		mu 0 4 37 174 175 36
		f 4 145 -148 -141 33
		mu 0 4 36 175 172 34
		f 4 148 150 -150 -40
		mu 0 4 38 176 177 39
		f 4 149 152 -152 -39
		mu 0 4 39 177 178 41
		f 4 151 -155 -154 40
		mu 0 4 41 178 179 40
		f 4 153 -156 -149 37
		mu 0 4 40 179 176 38
		f 4 156 158 -158 -44
		mu 0 4 42 180 181 43
		f 4 157 160 -160 -43
		mu 0 4 43 181 182 45
		f 4 159 -163 -162 44
		mu 0 4 45 182 183 44
		f 4 161 -164 -157 41
		mu 0 4 44 183 180 42
		f 4 164 166 -166 -48
		mu 0 4 46 184 185 47
		f 4 165 168 -168 -47
		mu 0 4 47 185 186 49
		f 4 167 -171 -170 48
		mu 0 4 49 186 187 48
		f 4 169 -172 -165 45
		mu 0 4 48 187 184 46
		f 4 172 174 -174 -52
		mu 0 4 50 188 189 51
		f 4 173 176 -176 -51
		mu 0 4 51 189 190 53
		f 4 175 -179 -178 52
		mu 0 4 53 190 191 52
		f 4 177 -180 -173 49
		mu 0 4 52 191 188 50
		f 4 180 182 -182 -56
		mu 0 4 54 192 193 55
		f 4 181 184 -184 -55
		mu 0 4 55 193 194 57
		f 4 183 -187 -186 56
		mu 0 4 57 194 195 56
		f 4 185 -188 -181 53
		mu 0 4 56 195 192 54
		f 4 188 190 -190 -60
		mu 0 4 58 196 197 59
		f 4 189 192 -192 -59
		mu 0 4 59 197 198 61
		f 4 191 -195 -194 60
		mu 0 4 61 198 199 60
		f 4 193 -196 -189 57
		mu 0 4 60 199 196 58
		f 4 196 198 -198 -64
		mu 0 4 62 200 201 63
		f 4 197 200 -200 -63
		mu 0 4 63 201 202 65
		f 4 199 -203 -202 64
		mu 0 4 65 202 203 64
		f 4 201 -204 -197 61
		mu 0 4 64 203 200 62;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface34" -p "group11";
	rename -uid "43768E63-4D73-8D9E-5633-D2B5444BA3CD";
	setAttr ".t" -type "double3" 935.71618394242398 -1012.7161978555422 92.827556460246569 ;
	setAttr ".r" -type "double3" 90 0 90 ;
	setAttr ".s" -type "double3" 1 1.657491075826123 1 ;
	setAttr ".rp" -type "double3" 817.56686401367188 -3.0662759821607919 163.99123764038086 ;
	setAttr ".rpt" -type "double3" -653.57562637329102 820.63313999583272 -167.05751362254165 ;
	setAttr ".sp" -type "double3" 817.56686401367188 -1.8499502210788705 163.99123764038086 ;
	setAttr ".spt" -type "double3" 0 -1.2163257610819214 0 ;
createNode mesh -n "polySurfaceShape34" -p "polySurface34";
	rename -uid "CA46FC7E-4738-C859-E47D-68801E041139";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:14]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0:14]";
	setAttr ".pv" -type "double2" 0.62062501907348633 0.81865331530570984 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 20 ".uvst[0].uvsp[0:19]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.91166663
		 0.62062502 0.73833334 0.62062496 0.51166654 0.62062496 0.33833334 0.62062502 0.87955993
		 0.62062502 0.87955993 0.62062502 0.72564 0.62062502 0.72564 0.62062502 0.87955993
		 0.62062502 0.72564 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.89561445
		 0.62062502 0.73833334 0.62062502 0.91166663 0.62062502 0.73198712;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 18 ".vt[0:17]"  817.56689453 -1.85003662 111.11704254 817.56689453 -1.85003662 216.86547852
		 817.5668335 -16.64996338 216.86546326 817.5668335 -16.64996338 111.11699677 818.56689453 -1.85003662 216.86547852
		 818.56689453 -1.85003662 111.11704254 817.5668335 -15.82116699 216.86546326 818.5668335 -15.82116699 216.86546326
		 818.5668335 -15.82116699 111.11700439 817.5668335 -15.82116699 111.11700439 815.5668335 -15.82116699 111.11700439
		 815.5668335 -15.82116699 216.86546326 815.5668335 -16.64996338 111.11699677 815.5668335 -16.64996338 216.86546326
		 818.5668335 -16.2355957 216.86546326 818.08782959 -16.64996338 216.86546326 818.5668335 -16.2355957 111.11699677
		 818.08782959 -16.64996338 111.11699677;
	setAttr -s 31 ".ed[0:30]"  1 0 0 1 6 0 2 3 1 0 9 0 1 4 0 0 5 0 4 5 0
		 2 15 0 4 7 0 3 17 0 5 8 0 6 2 1 7 14 0 8 16 0 9 3 1 6 7 1 7 8 1 8 9 1 9 6 0 9 10 0
		 6 11 0 10 11 0 3 12 0 10 12 0 2 13 0 13 12 0 11 13 0 15 14 0 16 17 0 14 16 0 17 15 0;
	setAttr -s 15 -ch 62 ".fc[0:14]" -type "polyFaces" 
		f 4 -7 8 16 -11
		mu 0 4 6 7 9 10
		f 4 3 18 -2 0
		mu 0 4 2 11 8 3
		f 4 -1 4 6 -6
		mu 0 4 0 1 7 6
		f 4 1 15 -9 -5
		mu 0 4 1 8 9 7
		f 4 2 9 30 -8
		mu 0 4 4 5 17 18
		f 4 17 -4 5 10
		mu 0 4 10 11 0 6
		f 5 -16 11 7 27 -13
		mu 0 5 9 8 4 18 16
		f 4 -17 12 29 -14
		mu 0 4 10 9 16 19
		f 5 -15 -18 13 28 -10
		mu 0 5 5 11 10 19 17
		f 4 -22 23 -26 -27
		mu 0 4 12 13 14 15
		f 4 -19 19 21 -21
		mu 0 4 8 11 13 12
		f 4 14 22 -24 -20
		mu 0 4 11 5 14 13
		f 4 -3 24 25 -23
		mu 0 4 5 4 15 14
		f 4 -12 20 26 -25
		mu 0 4 4 8 12 15
		f 4 -28 -31 -29 -30
		mu 0 4 16 18 17 19;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape67" -p "polySurface34";
	rename -uid "9F08882D-44FD-D32B-3881-45BFE6D42D00";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 6 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "bottom";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".gtag[2].gtagnm" -type "string" "front";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "left";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "right";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[5].gtagnm" -type "string" "top";
	setAttr ".gtag[5].gtagcmp" -type "componentList" 1 "f[0]";
	setAttr ".pv" -type "double2" 0.62062498927116394 0.62499998509883881 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.62062496 0.51166654
		 0.62062496 0.33833334 0.62062502 0.91166663 0.62062502 0.73833334;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  817.56689453 -1.84999418 111.11704254 817.56689453 -1.84999418 216.86547852
		 817.5668335 -16.64995193 216.86546326 817.5668335 -16.64995193 111.11699677;
	setAttr -s 4 ".ed[0:3]"  1 0 0 1 2 0 2 3 0 0 3 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -1 1 2 -4
		mu 0 4 0 1 2 3;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface43" -p "group11";
	rename -uid "0E762E30-4593-D535-E699-BAABE750740C";
	setAttr ".t" -type "double3" 1118.5 -257 175 ;
	setAttr ".rp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
	setAttr ".sp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
createNode mesh -n "polySurfaceShape73" -p "polySurface43";
	rename -uid "918045A7-40D1-3F1E-2169-54ADD7BA0AAA";
	setAttr -k off ".v";
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[20:117]";
	setAttr ".iog[0].og[3].gcl" -type "componentList" 1 "f[0:19]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.74500000476837158 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 182 ".uvst[0].uvsp[0:181]" -type "float2" 0.99000001 0.5 0.5
		 0.5 0.5 0.25 0.99000001 0.25 0.86750001 0.5 0.86750001 0.25 0.74500012 0.5 0.74500012
		 0.25 0.62250006 0.5 0.62250006 0.25 0.99000001 0.45000002 0.86750001 0.45000002 0.74500018
		 0.45000002 0.62250006 0.45000002 0.5 0.45000002 0.99000001 0.40000001 0.86750001
		 0.40000001 0.74500018 0.40000001 0.62250006 0.40000001 0.5 0.40000001 0.99000001
		 0.35000005 0.86749995 0.35000005 0.74500012 0.35000005 0.62250006 0.35000005 0.5
		 0.35000005 0.99000001 0.30000001 0.86749995 0.30000001 0.74500012 0.30000001 0.62250006
		 0.30000001 0.5 0.30000001 0.99000001 0.30000001 0.86749995 0.30000001 0.86750001
		 0.25 0.99000001 0.25 0.86749995 0.30000001 0.74500012 0.30000001 0.74500012 0.25
		 0.86750001 0.25 0.74500012 0.30000001 0.62250006 0.30000001 0.62250006 0.25 0.74500012
		 0.25 0.62250006 0.30000001 0.5 0.30000001 0.5 0.25 0.62250006 0.25 0.86750001 0.5
		 0.86750001 0.45000002 0.99000001 0.45000002 0.99000001 0.5 0.74500012 0.5 0.74500018
		 0.45000002 0.86750001 0.45000002 0.86750001 0.5 0.62250006 0.5 0.62250006 0.45000002
		 0.74500018 0.45000002 0.74500012 0.5 0.5 0.5 0.5 0.45000002 0.62250006 0.45000002
		 0.62250006 0.5 0.99000001 0.45000002 0.86750001 0.45000002 0.86750001 0.40000001
		 0.99000001 0.40000001 0.86750001 0.45000002 0.74500018 0.45000002 0.74500018 0.40000001
		 0.86750001 0.40000001 0.74500018 0.45000002 0.62250006 0.45000002 0.62250006 0.40000001
		 0.74500018 0.40000001 0.62250006 0.45000002 0.5 0.45000002 0.5 0.40000001 0.62250006
		 0.40000001 0.99000001 0.40000001 0.86750001 0.40000001 0.86749995 0.35000005 0.99000001
		 0.35000005 0.86750001 0.40000001 0.74500018 0.40000001 0.74500012 0.35000005 0.86749995
		 0.35000005 0.74500018 0.40000001 0.62250006 0.40000001 0.62250006 0.35000005 0.74500012
		 0.35000005 0.62250006 0.40000001 0.5 0.40000001 0.5 0.35000005 0.62250006 0.35000005
		 0.99000001 0.35000005 0.86749995 0.35000005 0.86749995 0.30000001 0.99000001 0.30000001
		 0.86749995 0.35000005 0.74500012 0.35000005 0.74500012 0.30000001 0.86749995 0.30000001
		 0.74500012 0.35000005 0.62250006 0.35000005 0.62250006 0.30000001 0.74500012 0.30000001
		 0.62250006 0.35000005 0.5 0.35000005 0.5 0.30000001 0.62250006 0.30000001 0 0 1 0
		 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1
		 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1
		 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0
		 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 128 ".pt[0:127]" -type "float3"  3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 -5 0 0 -5 0 0 -5 0 0 
		-5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 
		0 -5 0 0 -5 0 0 -5 0 0;
	setAttr -s 128 ".vt[0:127]"  50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 175.96736145 -79.99996948 50 175.96736145 47.37600708 50 418.88574219 15.53201294
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 370.30209351 47.37600708
		 50 370.30209351 15.53201294 50 370.30209351 -16.31195068 50 370.30209351 -48.15596008
		 50 370.30209351 -79.99996948 50 321.71841431 47.37600708 50 321.71841431 15.53201294
		 50 321.71841431 -16.31195068 50 321.71841431 -48.15596008 50 321.71841431 -79.99996948
		 50 273.13476563 47.37600708 50 273.13476563 15.53201294 50 273.13476563 -16.31195068
		 50 273.13476563 -48.15596008 50 273.13476563 -79.99996948 50 224.55105591 47.37600708
		 50 224.55105591 15.53201294 50 224.55105591 -16.31195068 50 224.55105591 -48.15596008
		 50 224.55105591 -79.99996948 50.32836914 223.55105591 46.37600708 50.32836914 223.55105591 16.53201294
		 50.32836914 176.96736145 16.53201294 50.32836914 176.96736145 46.37600708 50.32836914 223.55105591 14.53201294
		 50.32836914 223.55105591 -15.31195068 50.32836914 176.96736145 -15.31195068 50.32836914 176.96736145 14.53201294
		 50.32836914 223.55105591 -17.31195068 50.32836914 223.55105591 -47.15596008 50.32836914 176.96736145 -47.15596008
		 50.32836914 176.96736145 -17.31195068 50.32836914 223.55105591 -49.15596008 50.32836914 223.55105591 -78.99996948
		 50.32836914 176.96736145 -78.99996948 50.32836914 176.96736145 -49.15596008 50.32836914 417.88574219 16.53201294
		 50.32836914 371.30209351 16.53201294 50.32836914 371.30209351 46.37600708 50.32836914 417.88574219 46.37600708
		 50.32836914 417.88574219 -15.31195068 50.32836914 371.30209351 -15.31195068 50.32836914 371.30209351 14.53201294
		 50.32836914 417.88574219 14.53201294 50.32836914 417.88574219 -47.15596008 50.32836914 371.30209351 -47.15596008
		 50.32836914 371.30209351 -17.31195068 50.32836914 417.88574219 -17.31195068 50.32836914 417.88574219 -78.99996948
		 50.32836914 371.30209351 -78.99996948 50.32836914 371.30209351 -49.15596008 50.32836914 417.88574219 -49.15596008
		 50.32836914 369.30209351 46.37600708 50.32836914 369.30209351 16.53201294 50.32836914 322.71841431 16.53201294
		 50.32836914 322.71841431 46.37600708 50.32836914 369.30209351 14.53201294 50.32836914 369.30209351 -15.31195068
		 50.32836914 322.71841431 -15.31195068 50.32836914 322.71841431 14.53201294 50.32836914 369.30209351 -17.31195068
		 50.32836914 369.30209351 -47.15596008 50.32836914 322.71841431 -47.15596008 50.32836914 322.71841431 -17.31195068
		 50.32836914 369.30209351 -49.15596008 50.32836914 369.30209351 -78.99996948 50.32836914 322.71841431 -78.99996948
		 50.32836914 322.71841431 -49.15596008 50.32836914 320.71841431 46.37600708 50.32836914 320.71841431 16.53201294
		 50.32836914 274.13476563 16.53201294 50.32836914 274.13476563 46.37600708 50.32836914 320.71841431 14.53201294
		 50.32836914 320.71841431 -15.31195068 50.32836914 274.13476563 -15.31195068 50.32836914 274.13476563 14.53201294
		 50.32836914 320.71841431 -17.31195068 50.32836914 320.71841431 -47.15596008 50.32836914 274.13476563 -47.15596008
		 50.32836914 274.13476563 -17.31195068 50.32836914 320.71841431 -49.15596008 50.32836914 320.71841431 -78.99996948
		 50.32836914 274.13476563 -78.99996948 50.32836914 274.13476563 -49.15596008 50.32836914 272.13476563 46.37600708
		 50.32836914 272.13476563 16.53201294 50.32836914 225.55105591 16.53201294 50.32836914 225.55105591 46.37600708
		 50.32836914 272.13476563 14.53201294 50.32836914 272.13476563 -15.31195068 50.32836914 225.55105591 -15.31195068
		 50.32836914 225.55105591 14.53201294 50.32836914 272.13476563 -17.31195068 50.32836914 272.13476563 -47.15596008
		 50.32836914 225.55105591 -47.15596008 50.32836914 225.55105591 -17.31195068 50.32836914 272.13476563 -49.15596008
		 50.32836914 272.13476563 -78.99996948 50.32836914 225.55105591 -78.99996948 50.32836914 225.55105591 -49.15596008
		 50 418.88574219 47.37600708 50 418.88574219 15.53201294 50 370.30209351 47.37600708
		 50 418.88574219 -79.99996948 50 370.30209351 -79.99996948 50 175.96736145 47.37600708
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 175.96736145 -79.99996948
		 50 321.71841431 47.37600708 50 321.71841431 -79.99996948 50 273.13476563 47.37600708
		 50 273.13476563 -79.99996948 50 224.55105591 47.37600708 50 224.55105591 -79.99996948;
	setAttr -s 245 ".ed";
	setAttr ".ed[0:165]"  0 4 0 0 10 0 1 14 0 3 5 0 4 6 0 5 7 0 4 11 1 6 8 0
		 7 9 0 6 12 1 8 1 0 9 2 0 8 13 1 10 15 0 11 16 1 12 17 1 13 18 1 14 19 0 10 11 1 11 12 1
		 12 13 1 13 14 1 15 20 0 16 21 1 17 22 1 18 23 1 19 24 0 15 16 1 16 17 1 17 18 1 18 19 1
		 20 25 0 21 26 1 22 27 1 23 28 1 24 29 0 20 21 1 21 22 1 22 23 1 23 24 1 25 3 0 26 5 1
		 27 7 1 28 9 1 29 2 0 25 26 1 26 27 1 27 28 1 28 29 1 25 30 0 26 31 0 30 31 1 5 32 0
		 31 32 1 3 33 0 33 32 1 30 33 1 26 34 0 27 35 0 34 35 1 7 36 0 35 36 1 5 37 0 37 36 1
		 34 37 1 27 38 0 28 39 0 38 39 1 9 40 0 39 40 1 7 41 0 41 40 1 38 41 1 28 42 0 29 43 0
		 42 43 1 2 44 0 43 44 1 9 45 0 45 44 1 42 45 1 4 46 0 11 47 0 46 47 1 10 48 0 48 47 1
		 0 49 0 49 48 1 49 46 1 6 50 1 12 51 1 50 51 1 11 52 1 52 51 1 4 53 1 53 52 1 53 50 1
		 8 54 1 13 55 1 54 55 1 12 56 1 56 55 1 6 57 1 57 56 1 57 54 1 1 58 1 14 59 1 58 59 1
		 13 60 1 60 59 1 8 61 1 61 60 1 61 58 1 10 62 1 11 63 1 62 63 1 16 64 1 63 64 1 15 65 1
		 65 64 1 62 65 1 11 66 1 12 67 1 66 67 1 17 68 1 67 68 1 16 69 1 69 68 1 66 69 1 12 70 1
		 13 71 1 70 71 1 18 72 1 71 72 1 17 73 1 73 72 1 70 73 1 13 74 1 14 75 1 74 75 1 19 76 1
		 75 76 1 18 77 1 77 76 1 74 77 1 15 78 1 16 79 1 78 79 1 21 80 1 79 80 1 20 81 1 81 80 1
		 78 81 1 16 82 1 17 83 1 82 83 1 22 84 1 83 84 1 21 85 1 85 84 1 82 85 1 17 86 1 18 87 1
		 86 87 1 23 88 1 87 88 1;
	setAttr ".ed[166:244]" 22 89 1 89 88 1 86 89 1 18 90 1 19 91 1 90 91 1 24 92 1
		 91 92 1 23 93 1 93 92 1 90 93 1 20 94 1 21 95 1 94 95 1 26 96 1 95 96 1 25 97 1 97 96 1
		 94 97 1 21 98 1 22 99 1 98 99 1 27 100 1 99 100 1 26 101 1 101 100 1 98 101 1 22 102 1
		 23 103 1 102 103 1 28 104 1 103 104 1 27 105 1 105 104 1 102 105 1 23 106 1 24 107 1
		 106 107 1 29 108 1 107 108 1 28 109 1 109 108 1 106 109 1 0 110 0 4 111 0 110 111 0
		 10 112 0 110 112 0 1 113 0 14 114 0 113 114 0 3 115 0 5 116 0 115 116 0 6 117 0 111 117 0
		 7 118 0 116 118 0 8 119 0 117 119 0 9 120 0 118 120 0 119 113 0 2 121 0 120 121 0
		 15 122 0 112 122 0 19 123 0 114 123 0 20 124 0 122 124 0 24 125 0 123 125 0 25 126 0
		 124 126 0 29 127 0 125 127 0 126 115 0 127 121 0;
	setAttr -s 118 -ch 472 ".fc[0:117]" -type "polyFaces" 
		f 4 51 53 -56 -57
		mu 0 4 25 26 5 3
		f 4 59 61 -64 -65
		mu 0 4 26 27 7 5
		f 4 67 69 -72 -73
		mu 0 4 27 109 9 7
		f 4 75 77 -80 -81
		mu 0 4 109 108 2 9
		f 4 83 -86 -88 88
		mu 0 4 4 11 10 0
		f 4 91 -94 -96 96
		mu 0 4 6 12 11 4
		f 4 99 -102 -104 104
		mu 0 4 8 13 12 6
		f 4 107 -110 -112 112
		mu 0 4 1 14 13 8
		f 4 115 117 -120 -121
		mu 0 4 10 11 16 15
		f 4 123 125 -128 -129
		mu 0 4 11 12 17 16
		f 4 131 133 -136 -137
		mu 0 4 12 13 18 17
		f 4 139 141 -144 -145
		mu 0 4 13 14 19 18
		f 4 147 149 -152 -153
		mu 0 4 15 16 21 20
		f 4 155 157 -160 -161
		mu 0 4 16 17 22 21
		f 4 163 165 -168 -169
		mu 0 4 17 18 106 22
		f 4 171 173 -176 -177
		mu 0 4 18 19 107 106
		f 4 179 181 -184 -185
		mu 0 4 20 21 26 25
		f 4 187 189 -192 -193
		mu 0 4 21 22 27 26
		f 4 195 197 -200 -201
		mu 0 4 22 106 109 27
		f 4 203 205 -208 -209
		mu 0 4 106 107 108 109
		f 4 45 50 -52 -50
		mu 0 4 25 26 31 30
		f 4 41 52 -54 -51
		mu 0 4 26 5 32 31
		f 4 -4 54 55 -53
		mu 0 4 5 3 33 32
		f 4 -41 49 56 -55
		mu 0 4 3 25 30 33
		f 4 46 58 -60 -58
		mu 0 4 26 27 35 34
		f 4 42 60 -62 -59
		mu 0 4 27 7 36 35
		f 4 -6 62 63 -61
		mu 0 4 7 5 37 36
		f 4 -42 57 64 -63
		mu 0 4 5 26 34 37
		f 4 47 66 -68 -66
		mu 0 4 27 28 39 38
		f 4 43 68 -70 -67
		mu 0 4 28 9 40 39
		f 4 -9 70 71 -69
		mu 0 4 9 7 41 40
		f 4 -43 65 72 -71
		mu 0 4 7 27 38 41
		f 4 48 74 -76 -74
		mu 0 4 28 29 43 42
		f 4 44 76 -78 -75
		mu 0 4 29 2 44 43
		f 4 -12 78 79 -77
		mu 0 4 2 9 45 44
		f 4 -44 73 80 -79
		mu 0 4 9 28 42 45
		f 4 6 82 -84 -82
		mu 0 4 4 11 47 46
		f 4 -19 84 85 -83
		mu 0 4 11 10 48 47
		f 4 -2 86 87 -85
		mu 0 4 10 0 49 48
		f 4 0 81 -89 -87
		mu 0 4 0 4 46 49
		f 4 9 90 -92 -90
		mu 0 4 6 12 51 50
		f 4 -20 92 93 -91
		mu 0 4 12 11 52 51
		f 4 -7 94 95 -93
		mu 0 4 11 4 53 52
		f 4 4 89 -97 -95
		mu 0 4 4 6 50 53
		f 4 12 98 -100 -98
		mu 0 4 8 13 55 54
		f 4 -21 100 101 -99
		mu 0 4 13 12 56 55
		f 4 -10 102 103 -101
		mu 0 4 12 6 57 56
		f 4 7 97 -105 -103
		mu 0 4 6 8 54 57
		f 4 2 106 -108 -106
		mu 0 4 1 14 59 58
		f 4 -22 108 109 -107
		mu 0 4 14 13 60 59
		f 4 -13 110 111 -109
		mu 0 4 13 8 61 60
		f 4 10 105 -113 -111
		mu 0 4 8 1 58 61
		f 4 18 114 -116 -114
		mu 0 4 10 11 63 62
		f 4 14 116 -118 -115
		mu 0 4 11 16 64 63
		f 4 -28 118 119 -117
		mu 0 4 16 15 65 64
		f 4 -14 113 120 -119
		mu 0 4 15 10 62 65
		f 4 19 122 -124 -122
		mu 0 4 11 12 67 66
		f 4 15 124 -126 -123
		mu 0 4 12 17 68 67
		f 4 -29 126 127 -125
		mu 0 4 17 16 69 68
		f 4 -15 121 128 -127
		mu 0 4 16 11 66 69
		f 4 20 130 -132 -130
		mu 0 4 12 13 71 70
		f 4 16 132 -134 -131
		mu 0 4 13 18 72 71
		f 4 -30 134 135 -133
		mu 0 4 18 17 73 72
		f 4 -16 129 136 -135
		mu 0 4 17 12 70 73
		f 4 21 138 -140 -138
		mu 0 4 13 14 75 74
		f 4 17 140 -142 -139
		mu 0 4 14 19 76 75
		f 4 -31 142 143 -141
		mu 0 4 19 18 77 76
		f 4 -17 137 144 -143
		mu 0 4 18 13 74 77
		f 4 27 146 -148 -146
		mu 0 4 15 16 79 78
		f 4 23 148 -150 -147
		mu 0 4 16 21 80 79
		f 4 -37 150 151 -149
		mu 0 4 21 20 81 80
		f 4 -23 145 152 -151
		mu 0 4 20 15 78 81
		f 4 28 154 -156 -154
		mu 0 4 16 17 83 82
		f 4 24 156 -158 -155
		mu 0 4 17 22 84 83
		f 4 -38 158 159 -157
		mu 0 4 22 21 85 84
		f 4 -24 153 160 -159
		mu 0 4 21 16 82 85
		f 4 29 162 -164 -162
		mu 0 4 17 18 87 86
		f 4 25 164 -166 -163
		mu 0 4 18 23 88 87
		f 4 -39 166 167 -165
		mu 0 4 23 22 89 88
		f 4 -25 161 168 -167
		mu 0 4 22 17 86 89
		f 4 30 170 -172 -170
		mu 0 4 18 19 91 90
		f 4 26 172 -174 -171
		mu 0 4 19 24 92 91
		f 4 -40 174 175 -173
		mu 0 4 24 23 93 92
		f 4 -26 169 176 -175
		mu 0 4 23 18 90 93
		f 4 36 178 -180 -178
		mu 0 4 20 21 95 94
		f 4 32 180 -182 -179
		mu 0 4 21 26 96 95
		f 4 -46 182 183 -181
		mu 0 4 26 25 97 96
		f 4 -32 177 184 -183
		mu 0 4 25 20 94 97
		f 4 37 186 -188 -186
		mu 0 4 21 22 99 98
		f 4 33 188 -190 -187
		mu 0 4 22 27 100 99
		f 4 -47 190 191 -189
		mu 0 4 27 26 101 100
		f 4 -33 185 192 -191
		mu 0 4 26 21 98 101
		f 4 38 194 -196 -194
		mu 0 4 22 23 103 102
		f 4 34 196 -198 -195
		mu 0 4 23 28 104 103
		f 4 -48 198 199 -197
		mu 0 4 28 27 105 104
		f 4 -34 193 200 -199
		mu 0 4 27 22 102 105
		f 4 39 202 -204 -202
		mu 0 4 23 24 107 106
		f 4 35 204 -206 -203
		mu 0 4 24 29 108 107
		f 4 -49 206 207 -205
		mu 0 4 29 28 109 108
		f 4 -35 201 208 -207
		mu 0 4 28 23 106 109
		f 4 -1 209 211 -211
		mu 0 4 110 111 112 113
		f 4 1 212 -214 -210
		mu 0 4 114 115 116 117
		f 4 -3 214 216 -216
		mu 0 4 118 119 120 121
		f 4 3 218 -220 -218
		mu 0 4 122 123 124 125
		f 4 -5 210 221 -221
		mu 0 4 126 127 128 129
		f 4 5 222 -224 -219
		mu 0 4 130 131 132 133
		f 4 -8 220 225 -225
		mu 0 4 134 135 136 137
		f 4 8 226 -228 -223
		mu 0 4 138 139 140 141
		f 4 -11 224 228 -215
		mu 0 4 142 143 144 145
		f 4 11 229 -231 -227
		mu 0 4 146 147 148 149
		f 4 13 231 -233 -213
		mu 0 4 150 151 152 153
		f 4 -18 215 234 -234
		mu 0 4 154 155 156 157
		f 4 22 235 -237 -232
		mu 0 4 158 159 160 161
		f 4 -27 233 238 -238
		mu 0 4 162 163 164 165
		f 4 31 239 -241 -236
		mu 0 4 166 167 168 169
		f 4 -36 237 242 -242
		mu 0 4 170 171 172 173
		f 4 40 217 -244 -240
		mu 0 4 174 175 176 177
		f 4 -45 241 244 -230
		mu 0 4 178 179 180 181;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface44" -p "group11";
	rename -uid "EF912D2D-4191-A100-6B13-22A0FB461BCC";
	setAttr ".t" -type "double3" 1118.5 -257 -87.376068115234375 ;
	setAttr ".rp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
	setAttr ".sp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
createNode mesh -n "polySurfaceShape44" -p "polySurface44";
	rename -uid "87D72416-4CCD-1D84-2166-B08A316D73E9";
	setAttr -k off ".v";
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[20:117]";
	setAttr ".iog[0].og[3].gcl" -type "componentList" 1 "f[0:19]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.74500000476837158 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 182 ".uvst[0].uvsp[0:181]" -type "float2" 0.99000001 0.5 0.5
		 0.5 0.5 0.25 0.99000001 0.25 0.86750001 0.5 0.86750001 0.25 0.74500012 0.5 0.74500012
		 0.25 0.62250006 0.5 0.62250006 0.25 0.99000001 0.45000002 0.86750001 0.45000002 0.74500018
		 0.45000002 0.62250006 0.45000002 0.5 0.45000002 0.99000001 0.40000001 0.86750001
		 0.40000001 0.74500018 0.40000001 0.62250006 0.40000001 0.5 0.40000001 0.99000001
		 0.35000005 0.86749995 0.35000005 0.74500012 0.35000005 0.62250006 0.35000005 0.5
		 0.35000005 0.99000001 0.30000001 0.86749995 0.30000001 0.74500012 0.30000001 0.62250006
		 0.30000001 0.5 0.30000001 0.99000001 0.30000001 0.86749995 0.30000001 0.86750001
		 0.25 0.99000001 0.25 0.86749995 0.30000001 0.74500012 0.30000001 0.74500012 0.25
		 0.86750001 0.25 0.74500012 0.30000001 0.62250006 0.30000001 0.62250006 0.25 0.74500012
		 0.25 0.62250006 0.30000001 0.5 0.30000001 0.5 0.25 0.62250006 0.25 0.86750001 0.5
		 0.86750001 0.45000002 0.99000001 0.45000002 0.99000001 0.5 0.74500012 0.5 0.74500018
		 0.45000002 0.86750001 0.45000002 0.86750001 0.5 0.62250006 0.5 0.62250006 0.45000002
		 0.74500018 0.45000002 0.74500012 0.5 0.5 0.5 0.5 0.45000002 0.62250006 0.45000002
		 0.62250006 0.5 0.99000001 0.45000002 0.86750001 0.45000002 0.86750001 0.40000001
		 0.99000001 0.40000001 0.86750001 0.45000002 0.74500018 0.45000002 0.74500018 0.40000001
		 0.86750001 0.40000001 0.74500018 0.45000002 0.62250006 0.45000002 0.62250006 0.40000001
		 0.74500018 0.40000001 0.62250006 0.45000002 0.5 0.45000002 0.5 0.40000001 0.62250006
		 0.40000001 0.99000001 0.40000001 0.86750001 0.40000001 0.86749995 0.35000005 0.99000001
		 0.35000005 0.86750001 0.40000001 0.74500018 0.40000001 0.74500012 0.35000005 0.86749995
		 0.35000005 0.74500018 0.40000001 0.62250006 0.40000001 0.62250006 0.35000005 0.74500012
		 0.35000005 0.62250006 0.40000001 0.5 0.40000001 0.5 0.35000005 0.62250006 0.35000005
		 0.99000001 0.35000005 0.86749995 0.35000005 0.86749995 0.30000001 0.99000001 0.30000001
		 0.86749995 0.35000005 0.74500012 0.35000005 0.74500012 0.30000001 0.86749995 0.30000001
		 0.74500012 0.35000005 0.62250006 0.35000005 0.62250006 0.30000001 0.74500012 0.30000001
		 0.62250006 0.35000005 0.5 0.35000005 0.5 0.30000001 0.62250006 0.30000001 0 0 1 0
		 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1
		 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1
		 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0
		 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 128 ".pt[0:127]" -type "float3"  3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 -5 0 0 -5 0 0 -5 0 0 
		-5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 
		0 -5 0 0 -5 0 0 -5 0 0;
	setAttr -s 128 ".vt[0:127]"  50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 175.96736145 -79.99996948 50 175.96736145 47.37600708 50 418.88574219 15.53201294
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 370.30209351 47.37600708
		 50 370.30209351 15.53201294 50 370.30209351 -16.31195068 50 370.30209351 -48.15596008
		 50 370.30209351 -79.99996948 50 321.71841431 47.37600708 50 321.71841431 15.53201294
		 50 321.71841431 -16.31195068 50 321.71841431 -48.15596008 50 321.71841431 -79.99996948
		 50 273.13476563 47.37600708 50 273.13476563 15.53201294 50 273.13476563 -16.31195068
		 50 273.13476563 -48.15596008 50 273.13476563 -79.99996948 50 224.55105591 47.37600708
		 50 224.55105591 15.53201294 50 224.55105591 -16.31195068 50 224.55105591 -48.15596008
		 50 224.55105591 -79.99996948 50.32836914 223.55105591 46.37600708 50.32836914 223.55105591 16.53201294
		 50.32836914 176.96736145 16.53201294 50.32836914 176.96736145 46.37600708 50.32836914 223.55105591 14.53201294
		 50.32836914 223.55105591 -15.31195068 50.32836914 176.96736145 -15.31195068 50.32836914 176.96736145 14.53201294
		 50.32836914 223.55105591 -17.31195068 50.32836914 223.55105591 -47.15596008 50.32836914 176.96736145 -47.15596008
		 50.32836914 176.96736145 -17.31195068 50.32836914 223.55105591 -49.15596008 50.32836914 223.55105591 -78.99996948
		 50.32836914 176.96736145 -78.99996948 50.32836914 176.96736145 -49.15596008 50.32836914 417.88574219 16.53201294
		 50.32836914 371.30209351 16.53201294 50.32836914 371.30209351 46.37600708 50.32836914 417.88574219 46.37600708
		 50.32836914 417.88574219 -15.31195068 50.32836914 371.30209351 -15.31195068 50.32836914 371.30209351 14.53201294
		 50.32836914 417.88574219 14.53201294 50.32836914 417.88574219 -47.15596008 50.32836914 371.30209351 -47.15596008
		 50.32836914 371.30209351 -17.31195068 50.32836914 417.88574219 -17.31195068 50.32836914 417.88574219 -78.99996948
		 50.32836914 371.30209351 -78.99996948 50.32836914 371.30209351 -49.15596008 50.32836914 417.88574219 -49.15596008
		 50.32836914 369.30209351 46.37600708 50.32836914 369.30209351 16.53201294 50.32836914 322.71841431 16.53201294
		 50.32836914 322.71841431 46.37600708 50.32836914 369.30209351 14.53201294 50.32836914 369.30209351 -15.31195068
		 50.32836914 322.71841431 -15.31195068 50.32836914 322.71841431 14.53201294 50.32836914 369.30209351 -17.31195068
		 50.32836914 369.30209351 -47.15596008 50.32836914 322.71841431 -47.15596008 50.32836914 322.71841431 -17.31195068
		 50.32836914 369.30209351 -49.15596008 50.32836914 369.30209351 -78.99996948 50.32836914 322.71841431 -78.99996948
		 50.32836914 322.71841431 -49.15596008 50.32836914 320.71841431 46.37600708 50.32836914 320.71841431 16.53201294
		 50.32836914 274.13476563 16.53201294 50.32836914 274.13476563 46.37600708 50.32836914 320.71841431 14.53201294
		 50.32836914 320.71841431 -15.31195068 50.32836914 274.13476563 -15.31195068 50.32836914 274.13476563 14.53201294
		 50.32836914 320.71841431 -17.31195068 50.32836914 320.71841431 -47.15596008 50.32836914 274.13476563 -47.15596008
		 50.32836914 274.13476563 -17.31195068 50.32836914 320.71841431 -49.15596008 50.32836914 320.71841431 -78.99996948
		 50.32836914 274.13476563 -78.99996948 50.32836914 274.13476563 -49.15596008 50.32836914 272.13476563 46.37600708
		 50.32836914 272.13476563 16.53201294 50.32836914 225.55105591 16.53201294 50.32836914 225.55105591 46.37600708
		 50.32836914 272.13476563 14.53201294 50.32836914 272.13476563 -15.31195068 50.32836914 225.55105591 -15.31195068
		 50.32836914 225.55105591 14.53201294 50.32836914 272.13476563 -17.31195068 50.32836914 272.13476563 -47.15596008
		 50.32836914 225.55105591 -47.15596008 50.32836914 225.55105591 -17.31195068 50.32836914 272.13476563 -49.15596008
		 50.32836914 272.13476563 -78.99996948 50.32836914 225.55105591 -78.99996948 50.32836914 225.55105591 -49.15596008
		 50 418.88574219 47.37600708 50 418.88574219 15.53201294 50 370.30209351 47.37600708
		 50 418.88574219 -79.99996948 50 370.30209351 -79.99996948 50 175.96736145 47.37600708
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 175.96736145 -79.99996948
		 50 321.71841431 47.37600708 50 321.71841431 -79.99996948 50 273.13476563 47.37600708
		 50 273.13476563 -79.99996948 50 224.55105591 47.37600708 50 224.55105591 -79.99996948;
	setAttr -s 245 ".ed";
	setAttr ".ed[0:165]"  0 4 0 0 10 0 1 14 0 3 5 0 4 6 0 5 7 0 4 11 1 6 8 0
		 7 9 0 6 12 1 8 1 0 9 2 0 8 13 1 10 15 0 11 16 1 12 17 1 13 18 1 14 19 0 10 11 1 11 12 1
		 12 13 1 13 14 1 15 20 0 16 21 1 17 22 1 18 23 1 19 24 0 15 16 1 16 17 1 17 18 1 18 19 1
		 20 25 0 21 26 1 22 27 1 23 28 1 24 29 0 20 21 1 21 22 1 22 23 1 23 24 1 25 3 0 26 5 1
		 27 7 1 28 9 1 29 2 0 25 26 1 26 27 1 27 28 1 28 29 1 25 30 0 26 31 0 30 31 1 5 32 0
		 31 32 1 3 33 0 33 32 1 30 33 1 26 34 0 27 35 0 34 35 1 7 36 0 35 36 1 5 37 0 37 36 1
		 34 37 1 27 38 0 28 39 0 38 39 1 9 40 0 39 40 1 7 41 0 41 40 1 38 41 1 28 42 0 29 43 0
		 42 43 1 2 44 0 43 44 1 9 45 0 45 44 1 42 45 1 4 46 0 11 47 0 46 47 1 10 48 0 48 47 1
		 0 49 0 49 48 1 49 46 1 6 50 1 12 51 1 50 51 1 11 52 1 52 51 1 4 53 1 53 52 1 53 50 1
		 8 54 1 13 55 1 54 55 1 12 56 1 56 55 1 6 57 1 57 56 1 57 54 1 1 58 1 14 59 1 58 59 1
		 13 60 1 60 59 1 8 61 1 61 60 1 61 58 1 10 62 1 11 63 1 62 63 1 16 64 1 63 64 1 15 65 1
		 65 64 1 62 65 1 11 66 1 12 67 1 66 67 1 17 68 1 67 68 1 16 69 1 69 68 1 66 69 1 12 70 1
		 13 71 1 70 71 1 18 72 1 71 72 1 17 73 1 73 72 1 70 73 1 13 74 1 14 75 1 74 75 1 19 76 1
		 75 76 1 18 77 1 77 76 1 74 77 1 15 78 1 16 79 1 78 79 1 21 80 1 79 80 1 20 81 1 81 80 1
		 78 81 1 16 82 1 17 83 1 82 83 1 22 84 1 83 84 1 21 85 1 85 84 1 82 85 1 17 86 1 18 87 1
		 86 87 1 23 88 1 87 88 1;
	setAttr ".ed[166:244]" 22 89 1 89 88 1 86 89 1 18 90 1 19 91 1 90 91 1 24 92 1
		 91 92 1 23 93 1 93 92 1 90 93 1 20 94 1 21 95 1 94 95 1 26 96 1 95 96 1 25 97 1 97 96 1
		 94 97 1 21 98 1 22 99 1 98 99 1 27 100 1 99 100 1 26 101 1 101 100 1 98 101 1 22 102 1
		 23 103 1 102 103 1 28 104 1 103 104 1 27 105 1 105 104 1 102 105 1 23 106 1 24 107 1
		 106 107 1 29 108 1 107 108 1 28 109 1 109 108 1 106 109 1 0 110 0 4 111 0 110 111 0
		 10 112 0 110 112 0 1 113 0 14 114 0 113 114 0 3 115 0 5 116 0 115 116 0 6 117 0 111 117 0
		 7 118 0 116 118 0 8 119 0 117 119 0 9 120 0 118 120 0 119 113 0 2 121 0 120 121 0
		 15 122 0 112 122 0 19 123 0 114 123 0 20 124 0 122 124 0 24 125 0 123 125 0 25 126 0
		 124 126 0 29 127 0 125 127 0 126 115 0 127 121 0;
	setAttr -s 118 -ch 472 ".fc[0:117]" -type "polyFaces" 
		f 4 51 53 -56 -57
		mu 0 4 25 26 5 3
		f 4 59 61 -64 -65
		mu 0 4 26 27 7 5
		f 4 67 69 -72 -73
		mu 0 4 27 109 9 7
		f 4 75 77 -80 -81
		mu 0 4 109 108 2 9
		f 4 83 -86 -88 88
		mu 0 4 4 11 10 0
		f 4 91 -94 -96 96
		mu 0 4 6 12 11 4
		f 4 99 -102 -104 104
		mu 0 4 8 13 12 6
		f 4 107 -110 -112 112
		mu 0 4 1 14 13 8
		f 4 115 117 -120 -121
		mu 0 4 10 11 16 15
		f 4 123 125 -128 -129
		mu 0 4 11 12 17 16
		f 4 131 133 -136 -137
		mu 0 4 12 13 18 17
		f 4 139 141 -144 -145
		mu 0 4 13 14 19 18
		f 4 147 149 -152 -153
		mu 0 4 15 16 21 20
		f 4 155 157 -160 -161
		mu 0 4 16 17 22 21
		f 4 163 165 -168 -169
		mu 0 4 17 18 106 22
		f 4 171 173 -176 -177
		mu 0 4 18 19 107 106
		f 4 179 181 -184 -185
		mu 0 4 20 21 26 25
		f 4 187 189 -192 -193
		mu 0 4 21 22 27 26
		f 4 195 197 -200 -201
		mu 0 4 22 106 109 27
		f 4 203 205 -208 -209
		mu 0 4 106 107 108 109
		f 4 45 50 -52 -50
		mu 0 4 25 26 31 30
		f 4 41 52 -54 -51
		mu 0 4 26 5 32 31
		f 4 -4 54 55 -53
		mu 0 4 5 3 33 32
		f 4 -41 49 56 -55
		mu 0 4 3 25 30 33
		f 4 46 58 -60 -58
		mu 0 4 26 27 35 34
		f 4 42 60 -62 -59
		mu 0 4 27 7 36 35
		f 4 -6 62 63 -61
		mu 0 4 7 5 37 36
		f 4 -42 57 64 -63
		mu 0 4 5 26 34 37
		f 4 47 66 -68 -66
		mu 0 4 27 28 39 38
		f 4 43 68 -70 -67
		mu 0 4 28 9 40 39
		f 4 -9 70 71 -69
		mu 0 4 9 7 41 40
		f 4 -43 65 72 -71
		mu 0 4 7 27 38 41
		f 4 48 74 -76 -74
		mu 0 4 28 29 43 42
		f 4 44 76 -78 -75
		mu 0 4 29 2 44 43
		f 4 -12 78 79 -77
		mu 0 4 2 9 45 44
		f 4 -44 73 80 -79
		mu 0 4 9 28 42 45
		f 4 6 82 -84 -82
		mu 0 4 4 11 47 46
		f 4 -19 84 85 -83
		mu 0 4 11 10 48 47
		f 4 -2 86 87 -85
		mu 0 4 10 0 49 48
		f 4 0 81 -89 -87
		mu 0 4 0 4 46 49
		f 4 9 90 -92 -90
		mu 0 4 6 12 51 50
		f 4 -20 92 93 -91
		mu 0 4 12 11 52 51
		f 4 -7 94 95 -93
		mu 0 4 11 4 53 52
		f 4 4 89 -97 -95
		mu 0 4 4 6 50 53
		f 4 12 98 -100 -98
		mu 0 4 8 13 55 54
		f 4 -21 100 101 -99
		mu 0 4 13 12 56 55
		f 4 -10 102 103 -101
		mu 0 4 12 6 57 56
		f 4 7 97 -105 -103
		mu 0 4 6 8 54 57
		f 4 2 106 -108 -106
		mu 0 4 1 14 59 58
		f 4 -22 108 109 -107
		mu 0 4 14 13 60 59
		f 4 -13 110 111 -109
		mu 0 4 13 8 61 60
		f 4 10 105 -113 -111
		mu 0 4 8 1 58 61
		f 4 18 114 -116 -114
		mu 0 4 10 11 63 62
		f 4 14 116 -118 -115
		mu 0 4 11 16 64 63
		f 4 -28 118 119 -117
		mu 0 4 16 15 65 64
		f 4 -14 113 120 -119
		mu 0 4 15 10 62 65
		f 4 19 122 -124 -122
		mu 0 4 11 12 67 66
		f 4 15 124 -126 -123
		mu 0 4 12 17 68 67
		f 4 -29 126 127 -125
		mu 0 4 17 16 69 68
		f 4 -15 121 128 -127
		mu 0 4 16 11 66 69
		f 4 20 130 -132 -130
		mu 0 4 12 13 71 70
		f 4 16 132 -134 -131
		mu 0 4 13 18 72 71
		f 4 -30 134 135 -133
		mu 0 4 18 17 73 72
		f 4 -16 129 136 -135
		mu 0 4 17 12 70 73
		f 4 21 138 -140 -138
		mu 0 4 13 14 75 74
		f 4 17 140 -142 -139
		mu 0 4 14 19 76 75
		f 4 -31 142 143 -141
		mu 0 4 19 18 77 76
		f 4 -17 137 144 -143
		mu 0 4 18 13 74 77
		f 4 27 146 -148 -146
		mu 0 4 15 16 79 78
		f 4 23 148 -150 -147
		mu 0 4 16 21 80 79
		f 4 -37 150 151 -149
		mu 0 4 21 20 81 80
		f 4 -23 145 152 -151
		mu 0 4 20 15 78 81
		f 4 28 154 -156 -154
		mu 0 4 16 17 83 82
		f 4 24 156 -158 -155
		mu 0 4 17 22 84 83
		f 4 -38 158 159 -157
		mu 0 4 22 21 85 84
		f 4 -24 153 160 -159
		mu 0 4 21 16 82 85
		f 4 29 162 -164 -162
		mu 0 4 17 18 87 86
		f 4 25 164 -166 -163
		mu 0 4 18 23 88 87
		f 4 -39 166 167 -165
		mu 0 4 23 22 89 88
		f 4 -25 161 168 -167
		mu 0 4 22 17 86 89
		f 4 30 170 -172 -170
		mu 0 4 18 19 91 90
		f 4 26 172 -174 -171
		mu 0 4 19 24 92 91
		f 4 -40 174 175 -173
		mu 0 4 24 23 93 92
		f 4 -26 169 176 -175
		mu 0 4 23 18 90 93
		f 4 36 178 -180 -178
		mu 0 4 20 21 95 94
		f 4 32 180 -182 -179
		mu 0 4 21 26 96 95
		f 4 -46 182 183 -181
		mu 0 4 26 25 97 96
		f 4 -32 177 184 -183
		mu 0 4 25 20 94 97
		f 4 37 186 -188 -186
		mu 0 4 21 22 99 98
		f 4 33 188 -190 -187
		mu 0 4 22 27 100 99
		f 4 -47 190 191 -189
		mu 0 4 27 26 101 100
		f 4 -33 185 192 -191
		mu 0 4 26 21 98 101
		f 4 38 194 -196 -194
		mu 0 4 22 23 103 102
		f 4 34 196 -198 -195
		mu 0 4 23 28 104 103
		f 4 -48 198 199 -197
		mu 0 4 28 27 105 104
		f 4 -34 193 200 -199
		mu 0 4 27 22 102 105
		f 4 39 202 -204 -202
		mu 0 4 23 24 107 106
		f 4 35 204 -206 -203
		mu 0 4 24 29 108 107
		f 4 -49 206 207 -205
		mu 0 4 29 28 109 108
		f 4 -35 201 208 -207
		mu 0 4 28 23 106 109
		f 4 -1 209 211 -211
		mu 0 4 110 111 112 113
		f 4 1 212 -214 -210
		mu 0 4 114 115 116 117
		f 4 -3 214 216 -216
		mu 0 4 118 119 120 121
		f 4 3 218 -220 -218
		mu 0 4 122 123 124 125
		f 4 -5 210 221 -221
		mu 0 4 126 127 128 129
		f 4 5 222 -224 -219
		mu 0 4 130 131 132 133
		f 4 -8 220 225 -225
		mu 0 4 134 135 136 137
		f 4 8 226 -228 -223
		mu 0 4 138 139 140 141
		f 4 -11 224 228 -215
		mu 0 4 142 143 144 145
		f 4 11 229 -231 -227
		mu 0 4 146 147 148 149
		f 4 13 231 -233 -213
		mu 0 4 150 151 152 153
		f 4 -18 215 234 -234
		mu 0 4 154 155 156 157
		f 4 22 235 -237 -232
		mu 0 4 158 159 160 161
		f 4 -27 233 238 -238
		mu 0 4 162 163 164 165
		f 4 31 239 -241 -236
		mu 0 4 166 167 168 169
		f 4 -36 237 242 -242
		mu 0 4 170 171 172 173
		f 4 40 217 -244 -240
		mu 0 4 174 175 176 177
		f 4 -45 241 244 -230
		mu 0 4 178 179 180 181;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape77" -p "polySurface44";
	rename -uid "5B79C5C8-464F-E89B-C187-A090C520FBBE";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 2 "e[0]" "e[3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.74500000476837158 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.99000001 0.5 0.5
		 0.5 0.5 0.25 0.99000001 0.25;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 175.96736145 -79.99996948 50 175.96736145 47.37600708;
	setAttr -s 4 ".ed[0:3]"  0 1 0 0 3 0 1 2 0 3 2 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 2 -4 -2 0
		mu 0 4 1 2 3 0;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface45" -p "group11";
	rename -uid "6742F7D7-4928-3F85-5A1E-119054E0FDF2";
	setAttr ".t" -type "double3" 1118.5 -257 -349.75213623046875 ;
	setAttr ".rp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
	setAttr ".sp" -type "double3" 45 175.96736145019531 47.376007080078125 ;
createNode mesh -n "polySurfaceShape45" -p "polySurface45";
	rename -uid "120408CD-4AB1-EF55-8757-10BB99B00FE1";
	setAttr -k off ".v";
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[20:117]";
	setAttr ".iog[0].og[3].gcl" -type "componentList" 1 "f[0:19]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.74500000476837158 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 182 ".uvst[0].uvsp[0:181]" -type "float2" 0.99000001 0.5 0.5
		 0.5 0.5 0.25 0.99000001 0.25 0.86750001 0.5 0.86750001 0.25 0.74500012 0.5 0.74500012
		 0.25 0.62250006 0.5 0.62250006 0.25 0.99000001 0.45000002 0.86750001 0.45000002 0.74500018
		 0.45000002 0.62250006 0.45000002 0.5 0.45000002 0.99000001 0.40000001 0.86750001
		 0.40000001 0.74500018 0.40000001 0.62250006 0.40000001 0.5 0.40000001 0.99000001
		 0.35000005 0.86749995 0.35000005 0.74500012 0.35000005 0.62250006 0.35000005 0.5
		 0.35000005 0.99000001 0.30000001 0.86749995 0.30000001 0.74500012 0.30000001 0.62250006
		 0.30000001 0.5 0.30000001 0.99000001 0.30000001 0.86749995 0.30000001 0.86750001
		 0.25 0.99000001 0.25 0.86749995 0.30000001 0.74500012 0.30000001 0.74500012 0.25
		 0.86750001 0.25 0.74500012 0.30000001 0.62250006 0.30000001 0.62250006 0.25 0.74500012
		 0.25 0.62250006 0.30000001 0.5 0.30000001 0.5 0.25 0.62250006 0.25 0.86750001 0.5
		 0.86750001 0.45000002 0.99000001 0.45000002 0.99000001 0.5 0.74500012 0.5 0.74500018
		 0.45000002 0.86750001 0.45000002 0.86750001 0.5 0.62250006 0.5 0.62250006 0.45000002
		 0.74500018 0.45000002 0.74500012 0.5 0.5 0.5 0.5 0.45000002 0.62250006 0.45000002
		 0.62250006 0.5 0.99000001 0.45000002 0.86750001 0.45000002 0.86750001 0.40000001
		 0.99000001 0.40000001 0.86750001 0.45000002 0.74500018 0.45000002 0.74500018 0.40000001
		 0.86750001 0.40000001 0.74500018 0.45000002 0.62250006 0.45000002 0.62250006 0.40000001
		 0.74500018 0.40000001 0.62250006 0.45000002 0.5 0.45000002 0.5 0.40000001 0.62250006
		 0.40000001 0.99000001 0.40000001 0.86750001 0.40000001 0.86749995 0.35000005 0.99000001
		 0.35000005 0.86750001 0.40000001 0.74500018 0.40000001 0.74500012 0.35000005 0.86749995
		 0.35000005 0.74500018 0.40000001 0.62250006 0.40000001 0.62250006 0.35000005 0.74500012
		 0.35000005 0.62250006 0.40000001 0.5 0.40000001 0.5 0.35000005 0.62250006 0.35000005
		 0.99000001 0.35000005 0.86749995 0.35000005 0.86749995 0.30000001 0.99000001 0.30000001
		 0.86749995 0.35000005 0.74500012 0.35000005 0.74500012 0.30000001 0.86749995 0.30000001
		 0.74500012 0.35000005 0.62250006 0.35000005 0.62250006 0.30000001 0.74500012 0.30000001
		 0.62250006 0.35000005 0.5 0.35000005 0.5 0.30000001 0.62250006 0.30000001 0 0 1 0
		 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1
		 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1
		 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0
		 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 128 ".pt[0:127]" -type "float3"  3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 
		0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 
		0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 
		3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 3 0 0 -5 0 0 -5 0 0 -5 0 0 
		-5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 0 -5 0 
		0 -5 0 0 -5 0 0 -5 0 0;
	setAttr -s 128 ".vt[0:127]"  50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 175.96736145 -79.99996948 50 175.96736145 47.37600708 50 418.88574219 15.53201294
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 370.30209351 47.37600708
		 50 370.30209351 15.53201294 50 370.30209351 -16.31195068 50 370.30209351 -48.15596008
		 50 370.30209351 -79.99996948 50 321.71841431 47.37600708 50 321.71841431 15.53201294
		 50 321.71841431 -16.31195068 50 321.71841431 -48.15596008 50 321.71841431 -79.99996948
		 50 273.13476563 47.37600708 50 273.13476563 15.53201294 50 273.13476563 -16.31195068
		 50 273.13476563 -48.15596008 50 273.13476563 -79.99996948 50 224.55105591 47.37600708
		 50 224.55105591 15.53201294 50 224.55105591 -16.31195068 50 224.55105591 -48.15596008
		 50 224.55105591 -79.99996948 50.32836914 223.55105591 46.37600708 50.32836914 223.55105591 16.53201294
		 50.32836914 176.96736145 16.53201294 50.32836914 176.96736145 46.37600708 50.32836914 223.55105591 14.53201294
		 50.32836914 223.55105591 -15.31195068 50.32836914 176.96736145 -15.31195068 50.32836914 176.96736145 14.53201294
		 50.32836914 223.55105591 -17.31195068 50.32836914 223.55105591 -47.15596008 50.32836914 176.96736145 -47.15596008
		 50.32836914 176.96736145 -17.31195068 50.32836914 223.55105591 -49.15596008 50.32836914 223.55105591 -78.99996948
		 50.32836914 176.96736145 -78.99996948 50.32836914 176.96736145 -49.15596008 50.32836914 417.88574219 16.53201294
		 50.32836914 371.30209351 16.53201294 50.32836914 371.30209351 46.37600708 50.32836914 417.88574219 46.37600708
		 50.32836914 417.88574219 -15.31195068 50.32836914 371.30209351 -15.31195068 50.32836914 371.30209351 14.53201294
		 50.32836914 417.88574219 14.53201294 50.32836914 417.88574219 -47.15596008 50.32836914 371.30209351 -47.15596008
		 50.32836914 371.30209351 -17.31195068 50.32836914 417.88574219 -17.31195068 50.32836914 417.88574219 -78.99996948
		 50.32836914 371.30209351 -78.99996948 50.32836914 371.30209351 -49.15596008 50.32836914 417.88574219 -49.15596008
		 50.32836914 369.30209351 46.37600708 50.32836914 369.30209351 16.53201294 50.32836914 322.71841431 16.53201294
		 50.32836914 322.71841431 46.37600708 50.32836914 369.30209351 14.53201294 50.32836914 369.30209351 -15.31195068
		 50.32836914 322.71841431 -15.31195068 50.32836914 322.71841431 14.53201294 50.32836914 369.30209351 -17.31195068
		 50.32836914 369.30209351 -47.15596008 50.32836914 322.71841431 -47.15596008 50.32836914 322.71841431 -17.31195068
		 50.32836914 369.30209351 -49.15596008 50.32836914 369.30209351 -78.99996948 50.32836914 322.71841431 -78.99996948
		 50.32836914 322.71841431 -49.15596008 50.32836914 320.71841431 46.37600708 50.32836914 320.71841431 16.53201294
		 50.32836914 274.13476563 16.53201294 50.32836914 274.13476563 46.37600708 50.32836914 320.71841431 14.53201294
		 50.32836914 320.71841431 -15.31195068 50.32836914 274.13476563 -15.31195068 50.32836914 274.13476563 14.53201294
		 50.32836914 320.71841431 -17.31195068 50.32836914 320.71841431 -47.15596008 50.32836914 274.13476563 -47.15596008
		 50.32836914 274.13476563 -17.31195068 50.32836914 320.71841431 -49.15596008 50.32836914 320.71841431 -78.99996948
		 50.32836914 274.13476563 -78.99996948 50.32836914 274.13476563 -49.15596008 50.32836914 272.13476563 46.37600708
		 50.32836914 272.13476563 16.53201294 50.32836914 225.55105591 16.53201294 50.32836914 225.55105591 46.37600708
		 50.32836914 272.13476563 14.53201294 50.32836914 272.13476563 -15.31195068 50.32836914 225.55105591 -15.31195068
		 50.32836914 225.55105591 14.53201294 50.32836914 272.13476563 -17.31195068 50.32836914 272.13476563 -47.15596008
		 50.32836914 225.55105591 -47.15596008 50.32836914 225.55105591 -17.31195068 50.32836914 272.13476563 -49.15596008
		 50.32836914 272.13476563 -78.99996948 50.32836914 225.55105591 -78.99996948 50.32836914 225.55105591 -49.15596008
		 50 418.88574219 47.37600708 50 418.88574219 15.53201294 50 370.30209351 47.37600708
		 50 418.88574219 -79.99996948 50 370.30209351 -79.99996948 50 175.96736145 47.37600708
		 50 175.96736145 15.53201294 50 418.88574219 -16.31195068 50 175.96736145 -16.31195068
		 50 418.88574219 -48.15596008 50 175.96736145 -48.15596008 50 175.96736145 -79.99996948
		 50 321.71841431 47.37600708 50 321.71841431 -79.99996948 50 273.13476563 47.37600708
		 50 273.13476563 -79.99996948 50 224.55105591 47.37600708 50 224.55105591 -79.99996948;
	setAttr -s 245 ".ed";
	setAttr ".ed[0:165]"  0 4 0 0 10 0 1 14 0 3 5 0 4 6 0 5 7 0 4 11 1 6 8 0
		 7 9 0 6 12 1 8 1 0 9 2 0 8 13 1 10 15 0 11 16 1 12 17 1 13 18 1 14 19 0 10 11 1 11 12 1
		 12 13 1 13 14 1 15 20 0 16 21 1 17 22 1 18 23 1 19 24 0 15 16 1 16 17 1 17 18 1 18 19 1
		 20 25 0 21 26 1 22 27 1 23 28 1 24 29 0 20 21 1 21 22 1 22 23 1 23 24 1 25 3 0 26 5 1
		 27 7 1 28 9 1 29 2 0 25 26 1 26 27 1 27 28 1 28 29 1 25 30 0 26 31 0 30 31 1 5 32 0
		 31 32 1 3 33 0 33 32 1 30 33 1 26 34 0 27 35 0 34 35 1 7 36 0 35 36 1 5 37 0 37 36 1
		 34 37 1 27 38 0 28 39 0 38 39 1 9 40 0 39 40 1 7 41 0 41 40 1 38 41 1 28 42 0 29 43 0
		 42 43 1 2 44 0 43 44 1 9 45 0 45 44 1 42 45 1 4 46 0 11 47 0 46 47 1 10 48 0 48 47 1
		 0 49 0 49 48 1 49 46 1 6 50 1 12 51 1 50 51 1 11 52 1 52 51 1 4 53 1 53 52 1 53 50 1
		 8 54 1 13 55 1 54 55 1 12 56 1 56 55 1 6 57 1 57 56 1 57 54 1 1 58 1 14 59 1 58 59 1
		 13 60 1 60 59 1 8 61 1 61 60 1 61 58 1 10 62 1 11 63 1 62 63 1 16 64 1 63 64 1 15 65 1
		 65 64 1 62 65 1 11 66 1 12 67 1 66 67 1 17 68 1 67 68 1 16 69 1 69 68 1 66 69 1 12 70 1
		 13 71 1 70 71 1 18 72 1 71 72 1 17 73 1 73 72 1 70 73 1 13 74 1 14 75 1 74 75 1 19 76 1
		 75 76 1 18 77 1 77 76 1 74 77 1 15 78 1 16 79 1 78 79 1 21 80 1 79 80 1 20 81 1 81 80 1
		 78 81 1 16 82 1 17 83 1 82 83 1 22 84 1 83 84 1 21 85 1 85 84 1 82 85 1 17 86 1 18 87 1
		 86 87 1 23 88 1 87 88 1;
	setAttr ".ed[166:244]" 22 89 1 89 88 1 86 89 1 18 90 1 19 91 1 90 91 1 24 92 1
		 91 92 1 23 93 1 93 92 1 90 93 1 20 94 1 21 95 1 94 95 1 26 96 1 95 96 1 25 97 1 97 96 1
		 94 97 1 21 98 1 22 99 1 98 99 1 27 100 1 99 100 1 26 101 1 101 100 1 98 101 1 22 102 1
		 23 103 1 102 103 1 28 104 1 103 104 1 27 105 1 105 104 1 102 105 1 23 106 1 24 107 1
		 106 107 1 29 108 1 107 108 1 28 109 1 109 108 1 106 109 1 0 110 0 4 111 0 110 111 0
		 10 112 0 110 112 0 1 113 0 14 114 0 113 114 0 3 115 0 5 116 0 115 116 0 6 117 0 111 117 0
		 7 118 0 116 118 0 8 119 0 117 119 0 9 120 0 118 120 0 119 113 0 2 121 0 120 121 0
		 15 122 0 112 122 0 19 123 0 114 123 0 20 124 0 122 124 0 24 125 0 123 125 0 25 126 0
		 124 126 0 29 127 0 125 127 0 126 115 0 127 121 0;
	setAttr -s 118 -ch 472 ".fc[0:117]" -type "polyFaces" 
		f 4 51 53 -56 -57
		mu 0 4 25 26 5 3
		f 4 59 61 -64 -65
		mu 0 4 26 27 7 5
		f 4 67 69 -72 -73
		mu 0 4 27 109 9 7
		f 4 75 77 -80 -81
		mu 0 4 109 108 2 9
		f 4 83 -86 -88 88
		mu 0 4 4 11 10 0
		f 4 91 -94 -96 96
		mu 0 4 6 12 11 4
		f 4 99 -102 -104 104
		mu 0 4 8 13 12 6
		f 4 107 -110 -112 112
		mu 0 4 1 14 13 8
		f 4 115 117 -120 -121
		mu 0 4 10 11 16 15
		f 4 123 125 -128 -129
		mu 0 4 11 12 17 16
		f 4 131 133 -136 -137
		mu 0 4 12 13 18 17
		f 4 139 141 -144 -145
		mu 0 4 13 14 19 18
		f 4 147 149 -152 -153
		mu 0 4 15 16 21 20
		f 4 155 157 -160 -161
		mu 0 4 16 17 22 21
		f 4 163 165 -168 -169
		mu 0 4 17 18 106 22
		f 4 171 173 -176 -177
		mu 0 4 18 19 107 106
		f 4 179 181 -184 -185
		mu 0 4 20 21 26 25
		f 4 187 189 -192 -193
		mu 0 4 21 22 27 26
		f 4 195 197 -200 -201
		mu 0 4 22 106 109 27
		f 4 203 205 -208 -209
		mu 0 4 106 107 108 109
		f 4 45 50 -52 -50
		mu 0 4 25 26 31 30
		f 4 41 52 -54 -51
		mu 0 4 26 5 32 31
		f 4 -4 54 55 -53
		mu 0 4 5 3 33 32
		f 4 -41 49 56 -55
		mu 0 4 3 25 30 33
		f 4 46 58 -60 -58
		mu 0 4 26 27 35 34
		f 4 42 60 -62 -59
		mu 0 4 27 7 36 35
		f 4 -6 62 63 -61
		mu 0 4 7 5 37 36
		f 4 -42 57 64 -63
		mu 0 4 5 26 34 37
		f 4 47 66 -68 -66
		mu 0 4 27 28 39 38
		f 4 43 68 -70 -67
		mu 0 4 28 9 40 39
		f 4 -9 70 71 -69
		mu 0 4 9 7 41 40
		f 4 -43 65 72 -71
		mu 0 4 7 27 38 41
		f 4 48 74 -76 -74
		mu 0 4 28 29 43 42
		f 4 44 76 -78 -75
		mu 0 4 29 2 44 43
		f 4 -12 78 79 -77
		mu 0 4 2 9 45 44
		f 4 -44 73 80 -79
		mu 0 4 9 28 42 45
		f 4 6 82 -84 -82
		mu 0 4 4 11 47 46
		f 4 -19 84 85 -83
		mu 0 4 11 10 48 47
		f 4 -2 86 87 -85
		mu 0 4 10 0 49 48
		f 4 0 81 -89 -87
		mu 0 4 0 4 46 49
		f 4 9 90 -92 -90
		mu 0 4 6 12 51 50
		f 4 -20 92 93 -91
		mu 0 4 12 11 52 51
		f 4 -7 94 95 -93
		mu 0 4 11 4 53 52
		f 4 4 89 -97 -95
		mu 0 4 4 6 50 53
		f 4 12 98 -100 -98
		mu 0 4 8 13 55 54
		f 4 -21 100 101 -99
		mu 0 4 13 12 56 55
		f 4 -10 102 103 -101
		mu 0 4 12 6 57 56
		f 4 7 97 -105 -103
		mu 0 4 6 8 54 57
		f 4 2 106 -108 -106
		mu 0 4 1 14 59 58
		f 4 -22 108 109 -107
		mu 0 4 14 13 60 59
		f 4 -13 110 111 -109
		mu 0 4 13 8 61 60
		f 4 10 105 -113 -111
		mu 0 4 8 1 58 61
		f 4 18 114 -116 -114
		mu 0 4 10 11 63 62
		f 4 14 116 -118 -115
		mu 0 4 11 16 64 63
		f 4 -28 118 119 -117
		mu 0 4 16 15 65 64
		f 4 -14 113 120 -119
		mu 0 4 15 10 62 65
		f 4 19 122 -124 -122
		mu 0 4 11 12 67 66
		f 4 15 124 -126 -123
		mu 0 4 12 17 68 67
		f 4 -29 126 127 -125
		mu 0 4 17 16 69 68
		f 4 -15 121 128 -127
		mu 0 4 16 11 66 69
		f 4 20 130 -132 -130
		mu 0 4 12 13 71 70
		f 4 16 132 -134 -131
		mu 0 4 13 18 72 71
		f 4 -30 134 135 -133
		mu 0 4 18 17 73 72
		f 4 -16 129 136 -135
		mu 0 4 17 12 70 73
		f 4 21 138 -140 -138
		mu 0 4 13 14 75 74
		f 4 17 140 -142 -139
		mu 0 4 14 19 76 75
		f 4 -31 142 143 -141
		mu 0 4 19 18 77 76
		f 4 -17 137 144 -143
		mu 0 4 18 13 74 77
		f 4 27 146 -148 -146
		mu 0 4 15 16 79 78
		f 4 23 148 -150 -147
		mu 0 4 16 21 80 79
		f 4 -37 150 151 -149
		mu 0 4 21 20 81 80
		f 4 -23 145 152 -151
		mu 0 4 20 15 78 81
		f 4 28 154 -156 -154
		mu 0 4 16 17 83 82
		f 4 24 156 -158 -155
		mu 0 4 17 22 84 83
		f 4 -38 158 159 -157
		mu 0 4 22 21 85 84
		f 4 -24 153 160 -159
		mu 0 4 21 16 82 85
		f 4 29 162 -164 -162
		mu 0 4 17 18 87 86
		f 4 25 164 -166 -163
		mu 0 4 18 23 88 87
		f 4 -39 166 167 -165
		mu 0 4 23 22 89 88
		f 4 -25 161 168 -167
		mu 0 4 22 17 86 89
		f 4 30 170 -172 -170
		mu 0 4 18 19 91 90
		f 4 26 172 -174 -171
		mu 0 4 19 24 92 91
		f 4 -40 174 175 -173
		mu 0 4 24 23 93 92
		f 4 -26 169 176 -175
		mu 0 4 23 18 90 93
		f 4 36 178 -180 -178
		mu 0 4 20 21 95 94
		f 4 32 180 -182 -179
		mu 0 4 21 26 96 95
		f 4 -46 182 183 -181
		mu 0 4 26 25 97 96
		f 4 -32 177 184 -183
		mu 0 4 25 20 94 97
		f 4 37 186 -188 -186
		mu 0 4 21 22 99 98
		f 4 33 188 -190 -187
		mu 0 4 22 27 100 99
		f 4 -47 190 191 -189
		mu 0 4 27 26 101 100
		f 4 -33 185 192 -191
		mu 0 4 26 21 98 101
		f 4 38 194 -196 -194
		mu 0 4 22 23 103 102
		f 4 34 196 -198 -195
		mu 0 4 23 28 104 103
		f 4 -48 198 199 -197
		mu 0 4 28 27 105 104
		f 4 -34 193 200 -199
		mu 0 4 27 22 102 105
		f 4 39 202 -204 -202
		mu 0 4 23 24 107 106
		f 4 35 204 -206 -203
		mu 0 4 24 29 108 107
		f 4 -49 206 207 -205
		mu 0 4 29 28 109 108
		f 4 -35 201 208 -207
		mu 0 4 28 23 106 109
		f 4 -1 209 211 -211
		mu 0 4 110 111 112 113
		f 4 1 212 -214 -210
		mu 0 4 114 115 116 117
		f 4 -3 214 216 -216
		mu 0 4 118 119 120 121
		f 4 3 218 -220 -218
		mu 0 4 122 123 124 125
		f 4 -5 210 221 -221
		mu 0 4 126 127 128 129
		f 4 5 222 -224 -219
		mu 0 4 130 131 132 133
		f 4 -8 220 225 -225
		mu 0 4 134 135 136 137
		f 4 8 226 -228 -223
		mu 0 4 138 139 140 141
		f 4 -11 224 228 -215
		mu 0 4 142 143 144 145
		f 4 11 229 -231 -227
		mu 0 4 146 147 148 149
		f 4 13 231 -233 -213
		mu 0 4 150 151 152 153
		f 4 -18 215 234 -234
		mu 0 4 154 155 156 157
		f 4 22 235 -237 -232
		mu 0 4 158 159 160 161
		f 4 -27 233 238 -238
		mu 0 4 162 163 164 165
		f 4 31 239 -241 -236
		mu 0 4 166 167 168 169
		f 4 -36 237 242 -242
		mu 0 4 170 171 172 173
		f 4 40 217 -244 -240
		mu 0 4 174 175 176 177
		f 4 -45 241 244 -230
		mu 0 4 178 179 180 181;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape78" -p "polySurface45";
	rename -uid "CA30084C-41E4-3DFC-EE02-968CA7D71CE7";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 2 "e[0]" "e[3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.74500000476837158 0.375 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.99000001 0.5 0.5
		 0.5 0.5 0.25 0.99000001 0.25;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 175.96736145 -79.99996948 50 175.96736145 47.37600708;
	setAttr -s 4 ".ed[0:3]"  0 1 0 0 3 0 1 2 0 3 2 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 2 -4 -2 0
		mu 0 4 1 2 3 0;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface48" -p "group11";
	rename -uid "A7C1BE37-4697-69B8-515F-ACB139864F90";
	setAttr ".t" -type "double3" 940.7940673828125 -257 175 ;
	setAttr ".rp" -type "double3" -16.2479248046875 126.8836669921875 -679 ;
	setAttr ".sp" -type "double3" -16.2479248046875 126.8836669921875 -679 ;
createNode mesh -n "polySurfaceShape48" -p "polySurface48";
	rename -uid "FA4A062B-4C52-DC63-2CCD-BDA96D730CC2";
	setAttr -k off ".v";
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[24:139]";
	setAttr ".iog[0].og[3].gcl" -type "componentList" 1 "f[0:23]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.5 1 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 211 ".uvst[0].uvsp[0:210]" -type "float2" 0.5 0.5 0.75 0.5
		 0.5 0.125 0.75 0.125 0.6875 0.5 0.6875 0.125 0.62500006 0.5 0.62500006 0.125 0.5625
		 0.5 0.5625 0.125 0.75 0.43749988 0.6875 0.43749988 0.62500006 0.43749988 0.5625 0.43749988
		 0.5 0.43749988 0.75 0.37499991 0.6875 0.37499991 0.62500006 0.37499991 0.5625 0.37499991
		 0.5 0.37499991 0.75 0.31249994 0.6875 0.31249994 0.62500006 0.31249994 0.5625 0.31249994
		 0.5 0.31249994 0.75 0.25 0.6875 0.25 0.625 0.25 0.5625 0.25 0.5 0.25 0.75 0.1875
		 0.6875 0.1875 0.625 0.1875 0.5625 0.1875 0.5 0.1875 0.75 0.1875 0.6875 0.1875 0.6875
		 0.125 0.75 0.125 0.6875 0.1875 0.625 0.1875 0.62500006 0.125 0.6875 0.125 0.625 0.1875
		 0.5625 0.1875 0.5625 0.125 0.62500006 0.125 0.5625 0.1875 0.5 0.1875 0.5 0.125 0.5625
		 0.125 0.6875 0.5 0.6875 0.43749988 0.75 0.43749988 0.75 0.5 0.62500006 0.5 0.62500006
		 0.43749988 0.6875 0.43749988 0.6875 0.5 0.5625 0.5 0.5625 0.43749988 0.62500006 0.43749988
		 0.62500006 0.5 0.5 0.5 0.5 0.43749988 0.5625 0.43749988 0.5625 0.5 0.75 0.43749988
		 0.6875 0.43749988 0.6875 0.37499991 0.75 0.37499991 0.6875 0.43749988 0.62500006
		 0.43749988 0.62500006 0.37499991 0.6875 0.37499991 0.62500006 0.43749988 0.5625 0.43749988
		 0.5625 0.37499991 0.62500006 0.37499991 0.5625 0.43749988 0.5 0.43749988 0.5 0.37499991
		 0.5625 0.37499991 0.75 0.37499991 0.6875 0.37499991 0.6875 0.31249994 0.75 0.31249994
		 0.6875 0.37499991 0.62500006 0.37499991 0.62500006 0.31249994 0.6875 0.31249994 0.62500006
		 0.37499991 0.5625 0.37499991 0.5625 0.31249994 0.62500006 0.31249994 0.5625 0.37499991
		 0.5 0.37499991 0.5 0.31249994 0.5625 0.31249994 0.75 0.31249994 0.6875 0.31249994
		 0.6875 0.25 0.75 0.25 0.6875 0.31249994 0.62500006 0.31249994 0.625 0.25 0.6875 0.25
		 0.62500006 0.31249994 0.5625 0.31249994 0.5625 0.25 0.625 0.25 0.5625 0.31249994
		 0.5 0.31249994 0.5 0.25 0.5625 0.25 0.75 0.25 0.6875 0.25 0.6875 0.1875 0.75 0.1875
		 0.6875 0.25 0.625 0.25 0.625 0.1875 0.6875 0.1875 0.625 0.25 0.5625 0.25 0.5625 0.1875
		 0.625 0.1875 0.5625 0.25 0.5 0.25 0.5 0.1875 0.5625 0.1875 0 0 1 0 1 1 0 1 0 0 1
		 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0
		 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1
		 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1
		 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 20 ".pt[131:150]" -type "float3"  0 0 8 0 0 8 0 0 8 0 0 8 0 
		0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 0 0 8 
		0 0 8 0 0 8;
	setAttr -s 151 ".vt[0:150]"  -143.62390137 418.88574219 -679 -16.2479248 418.88574219 -679
		 -143.62390137 126.88366699 -679 -16.2479248 126.88366699 -679 -48.091918945 418.88574219 -679
		 -48.091918945 126.88366699 -679 -79.93591309 418.88574219 -679 -79.93591309 126.88366699 -679
		 -111.77990723 418.88574219 -679 -111.77990723 126.88366699 -679 -16.2479248 370.21862793 -679
		 -48.091918945 370.21862793 -679 -79.93591309 370.21862793 -679 -111.77990723 370.21862793 -679
		 -143.62390137 370.21862793 -679 -16.2479248 321.55163574 -679 -48.091918945 321.55163574 -679
		 -79.93591309 321.55163574 -679 -111.77990723 321.55163574 -679 -143.62390137 321.55163574 -679
		 -16.2479248 272.88464355 -679 -48.091918945 272.88464355 -679 -79.93591309 272.88464355 -679
		 -111.77990723 272.88464355 -679 -143.62390137 272.88464355 -679 -16.2479248 224.21769714 -679
		 -48.091918945 224.21769714 -679 -79.93591309 224.21769714 -679 -111.77990723 224.21769714 -679
		 -143.62390137 224.21769714 -679 -16.2479248 175.5506897 -679 -48.091918945 175.5506897 -679
		 -79.93591309 175.55067444 -679 -111.77990723 175.5506897 -679 -143.62390137 175.5506897 -679
		 -17.2479248 174.5506897 -680 -47.091918945 174.5506897 -680 -47.091918945 127.88366699 -680
		 -17.2479248 127.88366699 -680 -49.091918945 174.5506897 -680 -78.93591309 174.55067444 -680
		 -78.93591309 127.88366699 -680 -49.091918945 127.88366699 -680 -80.93591309 174.55067444 -680
		 -110.77990723 174.5506897 -680 -110.77990723 127.88366699 -680 -80.93591309 127.88366699 -680
		 -112.77990723 174.5506897 -680 -142.62390137 174.5506897 -680 -142.62390137 127.88366699 -680
		 -112.77990723 127.88366699 -680 -47.091918945 417.88574219 -680 -47.091918945 371.21862793 -680
		 -17.2479248 371.21862793 -680 -17.2479248 417.88574219 -680 -78.93591309 417.88574219 -680
		 -78.93591309 371.21862793 -680 -49.091918945 371.21862793 -680 -49.091918945 417.88574219 -680
		 -110.77990723 417.88574219 -680 -110.77990723 371.21862793 -680 -80.93591309 371.21862793 -680
		 -80.93591309 417.88574219 -680 -142.62390137 371.21862793 -680 -142.62390137 417.88574219 -680
		 -112.77990723 371.21862793 -680 -112.77990723 417.88574219 -680 -17.2479248 369.21862793 -680
		 -47.091918945 369.21862793 -680 -47.091918945 322.55163574 -680 -17.2479248 322.55163574 -680
		 -49.091918945 369.21862793 -680 -78.93591309 369.21862793 -680 -78.93591309 322.55163574 -680
		 -49.091918945 322.55163574 -680 -80.93591309 369.21862793 -680 -110.77990723 369.21862793 -680
		 -110.77990723 322.55163574 -680 -80.93591309 322.55163574 -680 -112.77990723 369.21862793 -680
		 -142.62390137 369.21862793 -680 -142.62390137 322.55163574 -680 -112.77990723 322.55163574 -680
		 -17.2479248 320.55163574 -680 -47.091918945 320.55163574 -680 -47.091918945 273.88464355 -680
		 -17.2479248 273.88464355 -680 -49.091918945 320.55163574 -680 -78.93591309 320.55163574 -680
		 -78.93591309 273.88464355 -680 -49.091918945 273.88464355 -680 -80.93591309 320.55163574 -680
		 -110.77990723 320.55163574 -680 -110.77990723 273.88464355 -680 -80.93591309 273.88464355 -680
		 -112.77990723 320.55163574 -680 -142.62390137 320.55163574 -680 -142.62390137 273.88464355 -680
		 -112.77990723 273.88464355 -680 -17.2479248 271.88464355 -680 -47.091918945 271.88464355 -680
		 -47.091918945 225.21769714 -680 -17.2479248 225.21769714 -680 -49.091918945 271.88464355 -680
		 -78.93591309 271.88464355 -680 -78.93591309 225.21769714 -680 -49.091918945 225.21769714 -680
		 -80.93591309 271.88464355 -680 -110.77990723 271.88464355 -680 -110.77990723 225.21769714 -680
		 -80.93591309 225.21769714 -680 -112.77990723 271.88464355 -680 -142.62390137 271.88464355 -680
		 -142.62390137 225.21769714 -680 -112.77990723 225.21769714 -680 -17.2479248 223.21769714 -680
		 -47.091918945 223.21769714 -680 -47.091918945 176.5506897 -680 -17.2479248 176.5506897 -680
		 -49.091918945 223.21769714 -680 -78.93591309 223.21769714 -680 -78.93591309 176.55067444 -680
		 -49.091918945 176.5506897 -680 -80.93591309 223.21769714 -680 -110.77990723 223.21769714 -680
		 -110.77990723 176.5506897 -680 -80.93591309 176.55067444 -680 -112.77990723 223.21769714 -680
		 -142.62390137 223.21769714 -680 -142.62390137 176.5506897 -680 -112.77990723 176.5506897 -680
		 -16.2479248 418.88574219 -679 -16.2479248 370.21862793 -679 -48.091918945 418.88574219 -679
		 -143.62390137 126.88366699 -679 -143.62390137 175.5506897 -679 -16.2479248 126.88366699 -679
		 -48.091918945 126.88366699 -679 -79.93591309 418.88574219 -679 -79.93591309 126.88366699 -679
		 -111.77990723 418.88574219 -679 -111.77990723 126.88366699 -679 -143.62390137 418.88574219 -679
		 -16.2479248 321.55163574 -679 -143.62390137 370.21862793 -679 -16.2479248 272.88464355 -679
		 -143.62390137 321.55163574 -679 -16.2479248 224.21769714 -679 -143.62390137 272.88464355 -679
		 -16.2479248 175.5506897 -679 -143.62390137 224.21769714 -679;
	setAttr -s 290 ".ed";
	setAttr ".ed[0:165]"  1 10 0 1 4 0 2 34 0 3 5 0 4 6 0 5 7 0 4 11 1 6 8 0
		 7 9 0 6 12 1 8 0 0 9 2 0 8 13 1 10 15 0 11 16 1 12 17 1 13 18 1 14 0 0 10 11 1 11 12 1
		 12 13 1 13 14 1 15 20 0 16 21 1 17 22 1 18 23 1 19 14 0 15 16 1 16 17 1 17 18 1 18 19 1
		 20 25 0 21 26 1 22 27 1 23 28 1 24 19 0 20 21 1 21 22 1 22 23 1 23 24 1 25 30 0 26 31 1
		 27 32 1 28 33 1 29 24 0 25 26 1 26 27 1 27 28 1 28 29 1 30 3 0 31 5 1 32 7 1 33 9 1
		 34 29 0 30 31 1 31 32 1 32 33 1 33 34 1 30 35 0 31 36 0 35 36 1 5 37 0 36 37 1 3 38 0
		 38 37 1 35 38 1 31 39 0 32 40 0 39 40 1 7 41 0 40 41 1 5 42 0 42 41 1 39 42 1 32 43 0
		 33 44 0 43 44 1 9 45 0 44 45 1 7 46 0 46 45 1 43 46 1 33 47 0 34 48 0 47 48 1 2 49 0
		 49 48 1 9 50 0 50 49 1 47 50 1 4 51 0 11 52 0 51 52 1 10 53 0 53 52 1 1 54 0 54 53 1
		 54 51 1 6 55 0 12 56 0 55 56 1 11 57 0 57 56 1 4 58 0 58 57 1 58 55 1 8 59 1 13 60 1
		 59 60 1 12 61 1 61 60 1 6 62 1 62 61 1 62 59 1 14 63 1 0 64 1 63 64 1 13 65 1 65 63 1
		 8 66 1 66 65 1 66 64 1 10 67 1 11 68 1 67 68 1 16 69 1 68 69 1 15 70 1 70 69 1 67 70 1
		 11 71 1 12 72 1 71 72 1 17 73 1 72 73 1 16 74 1 74 73 1 71 74 1 12 75 1 13 76 1 75 76 1
		 18 77 1 76 77 1 17 78 1 78 77 1 75 78 1 13 79 1 14 80 1 79 80 1 19 81 1 81 80 1 18 82 1
		 82 81 1 79 82 1 15 83 1 16 84 1 83 84 1 21 85 1 84 85 1 20 86 1 86 85 1 83 86 1 16 87 1
		 17 88 1 87 88 1 22 89 1;
	setAttr ".ed[166:289]" 88 89 1 21 90 1 90 89 1 87 90 1 17 91 1 18 92 1 91 92 1
		 23 93 1 92 93 1 22 94 1 94 93 1 91 94 1 18 95 1 19 96 1 95 96 1 24 97 1 97 96 1 23 98 1
		 98 97 1 95 98 1 20 99 1 21 100 1 99 100 1 26 101 1 100 101 1 25 102 1 102 101 1 99 102 1
		 21 103 1 22 104 1 103 104 1 27 105 1 104 105 1 26 106 1 106 105 1 103 106 1 22 107 1
		 23 108 1 107 108 1 28 109 1 108 109 1 27 110 1 110 109 1 107 110 1 23 111 1 24 112 1
		 111 112 1 29 113 1 113 112 1 28 114 1 114 113 1 111 114 1 25 115 1 26 116 1 115 116 1
		 31 117 1 116 117 1 30 118 1 118 117 1 115 118 1 26 119 1 27 120 1 119 120 1 32 121 1
		 120 121 1 31 122 1 122 121 1 119 122 1 27 123 1 28 124 1 123 124 1 33 125 1 124 125 1
		 32 126 1 126 125 1 123 126 1 28 127 1 29 128 1 127 128 1 34 129 1 129 128 1 33 130 1
		 130 129 1 127 130 1 1 131 0 10 132 0 131 132 0 4 133 0 131 133 0 2 134 0 34 135 0
		 134 135 0 3 136 0 5 137 0 136 137 0 6 138 0 133 138 0 7 139 0 137 139 0 8 140 0 138 140 0
		 9 141 0 139 141 0 0 142 0 140 142 0 141 134 0 15 143 0 132 143 0 14 144 0 144 142 0
		 20 145 0 143 145 0 19 146 0 146 144 0 25 147 0 145 147 0 24 148 0 148 146 0 30 149 0
		 147 149 0 29 150 0 150 148 0 149 136 0 135 150 0;
	setAttr -s 140 -ch 560 ".fc[0:139]" -type "polyFaces" 
		f 4 60 62 -65 -66
		mu 0 4 30 31 5 3
		f 4 68 70 -73 -74
		mu 0 4 31 32 7 5
		f 4 76 78 -81 -82
		mu 0 4 32 130 9 7
		f 4 84 -87 -89 -90
		mu 0 4 130 129 2 9
		f 4 92 -95 -97 97
		mu 0 4 4 11 10 1
		f 4 100 -103 -105 105
		mu 0 4 6 12 11 4
		f 4 108 -111 -113 113
		mu 0 4 8 13 12 6
		f 4 -117 -119 -121 121
		mu 0 4 0 14 13 8
		f 4 124 126 -129 -130
		mu 0 4 10 11 16 15
		f 4 132 134 -137 -138
		mu 0 4 11 12 17 16
		f 4 140 142 -145 -146
		mu 0 4 12 13 18 17
		f 4 148 -151 -153 -154
		mu 0 4 13 14 19 18
		f 4 156 158 -161 -162
		mu 0 4 15 16 21 20
		f 4 164 166 -169 -170
		mu 0 4 16 17 22 21
		f 4 172 174 -177 -178
		mu 0 4 17 18 23 22
		f 4 180 -183 -185 -186
		mu 0 4 18 19 24 23
		f 4 188 190 -193 -194
		mu 0 4 20 21 26 25
		f 4 196 198 -201 -202
		mu 0 4 21 22 27 26
		f 4 204 206 -209 -210
		mu 0 4 22 23 127 27
		f 4 212 -215 -217 -218
		mu 0 4 23 24 128 127
		f 4 220 222 -225 -226
		mu 0 4 25 26 31 30
		f 4 228 230 -233 -234
		mu 0 4 26 27 32 31
		f 4 236 238 -241 -242
		mu 0 4 27 127 130 32
		f 4 244 -247 -249 -250
		mu 0 4 127 128 129 130
		f 4 54 59 -61 -59
		mu 0 4 30 31 36 35
		f 4 50 61 -63 -60
		mu 0 4 31 5 37 36
		f 4 -4 63 64 -62
		mu 0 4 5 3 38 37
		f 4 -50 58 65 -64
		mu 0 4 3 30 35 38
		f 4 55 67 -69 -67
		mu 0 4 31 32 40 39
		f 4 51 69 -71 -68
		mu 0 4 32 7 41 40
		f 4 -6 71 72 -70
		mu 0 4 7 5 42 41
		f 4 -51 66 73 -72
		mu 0 4 5 31 39 42
		f 4 56 75 -77 -75
		mu 0 4 32 33 44 43
		f 4 52 77 -79 -76
		mu 0 4 33 9 45 44
		f 4 -9 79 80 -78
		mu 0 4 9 7 46 45
		f 4 -52 74 81 -80
		mu 0 4 7 32 43 46
		f 4 57 83 -85 -83
		mu 0 4 33 34 48 47
		f 4 -3 85 86 -84
		mu 0 4 34 2 49 48
		f 4 -12 87 88 -86
		mu 0 4 2 9 50 49
		f 4 -53 82 89 -88
		mu 0 4 9 33 47 50
		f 4 6 91 -93 -91
		mu 0 4 4 11 52 51
		f 4 -19 93 94 -92
		mu 0 4 11 10 53 52
		f 4 -1 95 96 -94
		mu 0 4 10 1 54 53
		f 4 1 90 -98 -96
		mu 0 4 1 4 51 54
		f 4 9 99 -101 -99
		mu 0 4 6 12 56 55
		f 4 -20 101 102 -100
		mu 0 4 12 11 57 56
		f 4 -7 103 104 -102
		mu 0 4 11 4 58 57
		f 4 4 98 -106 -104
		mu 0 4 4 6 55 58
		f 4 12 107 -109 -107
		mu 0 4 8 13 60 59
		f 4 -21 109 110 -108
		mu 0 4 13 12 61 60
		f 4 -10 111 112 -110
		mu 0 4 12 6 62 61
		f 4 7 106 -114 -112
		mu 0 4 6 8 59 62
		f 4 -18 114 116 -116
		mu 0 4 0 14 64 63
		f 4 -22 117 118 -115
		mu 0 4 14 13 65 64
		f 4 -13 119 120 -118
		mu 0 4 13 8 66 65
		f 4 10 115 -122 -120
		mu 0 4 8 0 63 66
		f 4 18 123 -125 -123
		mu 0 4 10 11 68 67
		f 4 14 125 -127 -124
		mu 0 4 11 16 69 68
		f 4 -28 127 128 -126
		mu 0 4 16 15 70 69
		f 4 -14 122 129 -128
		mu 0 4 15 10 67 70
		f 4 19 131 -133 -131
		mu 0 4 11 12 72 71
		f 4 15 133 -135 -132
		mu 0 4 12 17 73 72
		f 4 -29 135 136 -134
		mu 0 4 17 16 74 73
		f 4 -15 130 137 -136
		mu 0 4 16 11 71 74
		f 4 20 139 -141 -139
		mu 0 4 12 13 76 75
		f 4 16 141 -143 -140
		mu 0 4 13 18 77 76
		f 4 -30 143 144 -142
		mu 0 4 18 17 78 77
		f 4 -16 138 145 -144
		mu 0 4 17 12 75 78
		f 4 21 147 -149 -147
		mu 0 4 13 14 80 79
		f 4 -27 149 150 -148
		mu 0 4 14 19 81 80
		f 4 -31 151 152 -150
		mu 0 4 19 18 82 81
		f 4 -17 146 153 -152
		mu 0 4 18 13 79 82
		f 4 27 155 -157 -155
		mu 0 4 15 16 84 83
		f 4 23 157 -159 -156
		mu 0 4 16 21 85 84
		f 4 -37 159 160 -158
		mu 0 4 21 20 86 85
		f 4 -23 154 161 -160
		mu 0 4 20 15 83 86
		f 4 28 163 -165 -163
		mu 0 4 16 17 88 87
		f 4 24 165 -167 -164
		mu 0 4 17 22 89 88
		f 4 -38 167 168 -166
		mu 0 4 22 21 90 89
		f 4 -24 162 169 -168
		mu 0 4 21 16 87 90
		f 4 29 171 -173 -171
		mu 0 4 17 18 92 91
		f 4 25 173 -175 -172
		mu 0 4 18 23 93 92
		f 4 -39 175 176 -174
		mu 0 4 23 22 94 93
		f 4 -25 170 177 -176
		mu 0 4 22 17 91 94
		f 4 30 179 -181 -179
		mu 0 4 18 19 96 95
		f 4 -36 181 182 -180
		mu 0 4 19 24 97 96
		f 4 -40 183 184 -182
		mu 0 4 24 23 98 97
		f 4 -26 178 185 -184
		mu 0 4 23 18 95 98
		f 4 36 187 -189 -187
		mu 0 4 20 21 100 99
		f 4 32 189 -191 -188
		mu 0 4 21 26 101 100
		f 4 -46 191 192 -190
		mu 0 4 26 25 102 101
		f 4 -32 186 193 -192
		mu 0 4 25 20 99 102
		f 4 37 195 -197 -195
		mu 0 4 21 22 104 103
		f 4 33 197 -199 -196
		mu 0 4 22 27 105 104
		f 4 -47 199 200 -198
		mu 0 4 27 26 106 105
		f 4 -33 194 201 -200
		mu 0 4 26 21 103 106
		f 4 38 203 -205 -203
		mu 0 4 22 23 108 107
		f 4 34 205 -207 -204
		mu 0 4 23 28 109 108
		f 4 -48 207 208 -206
		mu 0 4 28 27 110 109
		f 4 -34 202 209 -208
		mu 0 4 27 22 107 110
		f 4 39 211 -213 -211
		mu 0 4 23 24 112 111
		f 4 -45 213 214 -212
		mu 0 4 24 29 113 112
		f 4 -49 215 216 -214
		mu 0 4 29 28 114 113
		f 4 -35 210 217 -216
		mu 0 4 28 23 111 114
		f 4 45 219 -221 -219
		mu 0 4 25 26 116 115
		f 4 41 221 -223 -220
		mu 0 4 26 31 117 116
		f 4 -55 223 224 -222
		mu 0 4 31 30 118 117
		f 4 -41 218 225 -224
		mu 0 4 30 25 115 118
		f 4 46 227 -229 -227
		mu 0 4 26 27 120 119
		f 4 42 229 -231 -228
		mu 0 4 27 32 121 120
		f 4 -56 231 232 -230
		mu 0 4 32 31 122 121
		f 4 -42 226 233 -232
		mu 0 4 31 26 119 122
		f 4 47 235 -237 -235
		mu 0 4 27 28 124 123
		f 4 43 237 -239 -236
		mu 0 4 28 33 125 124
		f 4 -57 239 240 -238
		mu 0 4 33 32 126 125
		f 4 -43 234 241 -240
		mu 0 4 32 27 123 126
		f 4 48 243 -245 -243
		mu 0 4 28 29 128 127
		f 4 -54 245 246 -244
		mu 0 4 29 34 129 128
		f 4 -58 247 248 -246
		mu 0 4 34 33 130 129
		f 4 -44 242 249 -248
		mu 0 4 33 28 127 130
		f 4 0 251 -253 -251
		mu 0 4 131 132 133 134
		f 4 -2 250 254 -254
		mu 0 4 135 136 137 138
		f 4 2 256 -258 -256
		mu 0 4 139 140 141 142
		f 4 3 259 -261 -259
		mu 0 4 143 144 145 146
		f 4 -5 253 262 -262
		mu 0 4 147 148 149 150
		f 4 5 263 -265 -260
		mu 0 4 151 152 153 154
		f 4 -8 261 266 -266
		mu 0 4 155 156 157 158
		f 4 8 267 -269 -264
		mu 0 4 159 160 161 162
		f 4 -11 265 270 -270
		mu 0 4 163 164 165 166
		f 4 11 255 -272 -268
		mu 0 4 167 168 169 170
		f 4 13 272 -274 -252
		mu 0 4 171 172 173 174
		f 4 17 269 -276 -275
		mu 0 4 175 176 177 178
		f 4 22 276 -278 -273
		mu 0 4 179 180 181 182
		f 4 26 274 -280 -279
		mu 0 4 183 184 185 186
		f 4 31 280 -282 -277
		mu 0 4 187 188 189 190
		f 4 35 278 -284 -283
		mu 0 4 191 192 193 194
		f 4 40 284 -286 -281
		mu 0 4 195 196 197 198
		f 4 44 282 -288 -287
		mu 0 4 199 200 201 202
		f 4 49 258 -289 -285
		mu 0 4 203 204 205 206
		f 4 53 286 -290 -257
		mu 0 4 207 208 209 210;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode mesh -n "polySurfaceShape82" -p "polySurface48";
	rename -uid "5AA3B4B9-4B46-D21C-6935-D49E023E37D5";
	setAttr -k off ".v";
	setAttr ".io" yes;
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";
	setAttr ".iog[0].og[1].gcl" -type "componentList" 2 "e[1]" "e[3]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 4 ".uvst[0].uvsp[0:3]" -type "float2" 0.5 0.5 0.75 0.5
		 0.5 0.125 0.75 0.125;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 4 ".vt[0:3]"  -143.62390137 418.88574219 -679 -16.2479248 418.88574219 -679
		 -143.62390137 126.88366699 -679 -16.2479248 126.88366699 -679;
	setAttr -s 4 ".ed[0:3]"  1 3 0 1 0 0 2 0 0 3 2 0;
	setAttr -ch 4 ".fc[0]" -type "polyFaces" 
		f 4 -3 -4 -1 1
		mu 0 4 0 2 3 1;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface46" -p "group11";
	rename -uid "5584F996-4F16-A47A-135F-6799E541A131";
	setAttr ".t" -type "double3" 1113.5 -257 175 ;
createNode mesh -n "polySurfaceShape79" -p "polySurface46";
	rename -uid "27CD5F8A-4944-7BC9-C3D2-9A973397D367";
	setAttr -k off ".v";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0:225]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 5 "e[3]" "e[382]" "e[410]" "e[445]" "e[476]";
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 5 "e[0]" "e[373]" "e[419]" "e[436]" "e[467]";
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 9 "e[1]" "e[51]" "e[66]" "e[83]" "e[100]" "e[149]" "e[252]" "e[277]" "e[300]";
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 9 "e[2]" "e[50]" "e[65]" "e[84]" "e[101]" "e[150]" "e[253]" "e[278]" "e[301]";
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 17 "e[0:3]" "e[50:51]" "e[65:66]" "e[83:84]" "e[100:101]" "e[149:150]" "e[252:253]" "e[277:278]" "e[300:301]" "e[373]" "e[382]" "e[410]" "e[419]" "e[436]" "e[445]" "e[467]" "e[476]";
	setAttr ".pv" -type "double2" 0.625 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 384 ".uvst[0].uvsp";
	setAttr ".uvst[0].uvsp[0:249]" -type "float2" 0 0 0.5 0 0.5 0.0099999998
		 0 0.0099999998 0 0 0.0099999998 0 0.0099999998 1 0 1 0 0 0.0099999998 0 0.0099999998
		 1 0 1 1 0.125 0.99000001 0.125 0.99000001 0 1 0 0 0 0.5 0 0.5 0.125 0 0.125 0 0 1
		 0 1 0.125 3.1581411e-07 0.12500007 0 0 1 0 1 0.125 0 0.125 0 0 0.0099999998 0 0.0099999048
		 0.12499984 -9.3249426e-08 0.12499984 1 0.5 0.99000001 0.5 0.99000001 0 1 0 0 0 0.5
		 0 0.5 0.5 0 0.5 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0
		 0 1 0 1.000000238419 0.30211955 0 0.125 0.99000001 1 0.99000001 0.5 1 0.5 1 1 0 0.5
		 0.5 0.5 0.5 1 0 1 0 0 0.0099999905 0 0.0099999895 1.056744695 0 1 0 0 1 0 1 1 0 1
		 0 0 0.010416657 0 0.010416657 0.5 0 0.5 0 0.5 0.010416657 0.5 0.010416657 1 0 1 0
		 0 0.010416657 0 0.010416657 0.125 0 0.125 0 0.98958337 0.5 0.98958337 0.5 1 0 1 0.98958337
		 1 0.98958337 0 1 0 1 1 0.98958337 1 0.98958337 0 1 0 1 1 1 0.125 0.98958337 0.125
		 0.98958337 0 1 0 0.98958325 6.61536217 0.98958337 0 1 0 0.99999994 6.6744709 0.5
		 0.125 0.5 0 0.5 0.5 0 0.5 0.5 0 0.5 1 0.5 0 0.5 1 0.49999994 0.12499993 0.5 0 0.5
		 0 0.49999997 3.83723545 0.66666669 4.78298092 0.66666675 0 0.83333349 0 0.83333337
		 5.72872639 0.83333349 0.12499997 0.66666675 0.12499995 0.66666675 0 0.83333349 0
		 0.66666675 1 0.66666675 0 0.83333349 0 0.83333349 1 0.66666675 1 0.66666675 0 0.83333349
		 0 0.83333349 1 0 0.66666675 0.5 0.66666675 0.5 0.83333349 0 0.83333349 0.33333325
		 0.125 0.16666651 0.125 0.16666651 0 0.33333325 0 0.16666651 1 0.16666651 0.5 0.33333325
		 0.5 0.33333325 1 0.33333325 0.5 0.16666651 0.5 0.16666651 0 0.33333325 0 0.33333325
		 0.125 0.33333325 0 0.33333325 1 0.33333325 0.5 0.5 0.5 0.5 1 0.5 0.5 0.33333325 0.5
		 0.33333325 0 0.5 0 0.16666651 0.125 0.16666651 0.125 0.16666651 0 0.16666651 0 0.33333325
		 0 0.33333325 0.125 0.16666651 1 0.16666651 0.5 0.16666651 0.5 0.16666651 1 0.33333325
		 1 0.33333325 0.5 0.16666651 0.5 0.16666651 0.5 0.16666651 0 0.16666651 0 0.33333325
		 0.5 0.33333325 0 0.33333325 1 0.16666651 1 0.16666651 1 0.33333325 1 0.16666651 1
		 0.33333325 1 0.91666675 0 0.91666663 6.20159864 0.91666675 0.12499999 0.91666675
		 0 0.91666675 0 0.91666675 1 0.91666675 0 0.91666675 1 0.5 0.91666675 0 0.91666675
		 0.083333254 0.125 0.083333254 0 0.083333254 1 0.083333254 0.5 0.083333254 0.5 0.083333254
		 0 0.99000001 1 0.99000001 0.75 1 0.75 1 1 0.5 1 0.5 0.75 0.33333325 0.75 0.33333325
		 0.75 0.33333325 0.75 0.16666651 0.75 0.16666651 0.75 0.16666651 0.75 0.083333254
		 1 0.083333254 0.75 0 0.75 0.010416657 0.75 0.010416657 1 0 1 0 0.75 0.5 0.75 0.5
		 1 0 1 0.99000001 0.25 1 0.25 0.33333325 0.25 0.5 0.25 0.33333325 0.25 0.33333325
		 0.25 0.16666651 0.25 0.16666651 0.25 0.16666651 0.25 0.083333254 0.25 0 0.25 0.010416657
		 0.25 0 0.25 0.5 0.25 6.3162821e-07 0.25000015 1 0.25 1 0.5 1.2632564e-06 0.5000003
		 0 0.25 1.000000119209 0.25 1.000000238419 0.5 0 0.5 0.98958337 0.5 0.98958337 0.25
		 1 0.25 1 0.5;
	setAttr ".uvst[0].uvsp[250:383]" 0.83333343 0.49999988 0.83333349 0.24999994
		 0.91666675 0.24999997 0.91666675 0.49999994 0.66666663 0.49999979 0.66666669 0.2499999
		 0.49999982 0.4999997 0.49999991 0.24999985 0.0099996217 0.49999937 0.0099998107 0.24999969
		 -1.8649885e-07 0.24999969 -3.729977e-07 0.49999937 0 0.25 1.000000596046 0.60423911
		 1.000001192093 1.20847821 0 0.5 0.95833337 0 0.95833325 6.43803501 0.95833337 0.24999999
		 0.95833337 0.49999997 0.95833337 0 0.95833337 0.12499999 0.95833337 0 0.95833337
		 1 0.95833337 0 0.95833337 1 0.5 0.95833337 0 0.95833337 0.041666627 0.125 0.041666627
		 0 0.041666627 0.75 0.041666627 0.5 0.041666627 1 0.97916669 0 0.97916663 6.55625296
		 0.97916669 0.25 0.97916669 0.5 0.97916669 0 0.97916669 0.125 0.97916669 0 0.97916669
		 1 0.97916669 0 0.97916669 1 0.5 0.97916669 0 0.97916669 0.020833313 0.125 0.020833313
		 0 0.020833313 0.5 0.020833313 0.25 0.041666627 0.25 0.041666627 0.5 0.020833313 1
		 0.041666627 1 0.020833313 0.5 0.020833313 0 0.041666627 0 0.020833313 0.75 0.020833313
		 1 0.75 0.0099999998 0.75 0 1 0 1 0.0099999998 0.75 0.5 1 0.5 0.75 0.66666675 1 0.66666675
		 0.75 0.83333349 1 0.83333349 0.75 0.91666675 1 0.91666675 0.75 0.95833337 1 0.95833337
		 0.75 0.97916669 1 0.97916669 0.75 0.98958337 1 0.98958337 0.75 1 1 1 0.75 0.125 0.75
		 0 1 0 1 0.125 0.75 0.25 1 0.25 0.75 0.5 1 0.5 0.75 1 1 1 0.75 0.5 0.75 0 1 0 1 0.5
		 0.75 0.75 1 0.75 0.75 1 1 1 0.25 0 0.25 0.0099999998 0.25 0.5 0.25 0.66666675 0.25
		 0.83333349 0.25 0.91666675 0.25 0.95833337 0.25 0.97916669 0.25 0.98958337 0.25 0
		 0.25 1 0.25 0.125 0.25 0.25 0.25 0.5 0.25 0 0.25 1 0.25 0.5 0.25 0.75 0.25 1 0.125
		 0 0.125 0.0099999998 0.125 0.5 0.125 0.66666675 0.125 0.83333349 0.125 0.91666675
		 0.125 0.95833337 0.125 0.97916669 0.125 0.98958337 0.125 0 0.125 1 0.125 0.125 0.125
		 0.25 0.125 0.5 0.125 0 0.125 1 0.125 0.5 0.125 0.75 0.125 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 269 ".vt";
	setAttr ".vt[0:165]"  -358 0 50 50 0 50 -358 0 -671 50 0 -671 -382 0 50 -382 0 -671
		 -667 0 50 -667 0 -671 50 257 50 50 257 -671 -358 257 -671 50 497 50 50 497 -671 -358 497 -671
		 -358 0 193 -382 0 193 -667 0 193 -358 0 518 -382 0 518 -667 0 518 50 232 50 50 232 -671
		 -358 232 -671 -382 232 -671 -667 232 -671 -667 232 50 -667 232 193 -382 232 50 -382 232 193
		 50 497 -79.99996948 50 257 -79.99996948 50 232 -79.99996948 50 0 -79.99996948 -358 0 -79.99996948
		 -382 0 -79.99996948 -667 0 -79.99996948 -667 232 -79.99996948 -382 232 -79.99996948
		 50 497 47.37600708 50 257 47.37600708 50 232 47.37600708 50 0 47.37600708 -358 0 47.37600708
		 -382 0 47.37600708 -667.000061035156 0 47.37600708 -667 232 47.37600708 -382 232 47.37600708
		 -382 232 -170.000030517578 -667 232 -170.000030517578 -667 0 -170.000030517578 -382 0 -170.000030517578
		 -358 0 -170.000030517578 50 0 -170.000030517578 50 232 -170.000030517578 50 257 -170.000030517578
		 50 497 -170.000030517578 -382 232 -124.99998474 -667 232 -124.99998474 -667 0 -124.99998474
		 -382 0 -124.99998474 -358 0 -124.99998474 50 0 -124.99998474 50 232 -124.99998474
		 50 257 -124.99998474 50 497 -124.99998474 50.32836914 1 -169.000030517578 50.32836914 232 -169.000030517578
		 50.32836914 1 -125.99998474 50.32836914 232 -125.99998474 50.32836914 257 -169.000030517578
		 50.32836914 257 -125.99998474 50.32836914 496 -169.000030517578 50.32836914 496 -125.99998474
		 50 2 -168.000030517578 50 232 -168.000030517578 50 2 -126.99998474 50 232 -126.99998474
		 50 257 -168.000030517578 50 257 -126.99998474 50 495 -168.000030517578 50 495 -126.99998474
		 -382 232 -215.000061035156 -667 232 -215.000061035156 -667 0 -215.000061035156 -382 0 -215.000061035156
		 -358 0 -215.000061035156 50 0 -215.000061035156 50 232 -215.000061035156 50 257 -215.000061035156
		 50 497 -215.000061035156 50 418.88574219 50 50 418.88574219 47.37600708 50 418.88574219 -79.99996948
		 50 418.88574219 -124.99998474 50.32836914 418.88574219 -125.99998474 50 418.88571167 -126.99998474
		 50 418.88571167 -168.000030517578 50.32836914 418.88574219 -169.000030517578 50 418.88574219 -170.000030517578
		 50 418.88574219 -215.000061035156 50 418.88574219 -671 -358 418.88574219 -671 -358 463.88577271 -671
		 50.00012207031 463.88577271 -671 50.00012207031 463.88577271 -215.000061035156 50.00012207031 463.88577271 -170.000030517578
		 50.32836914 463.88577271 -169.000030517578 50.00012207031 463.88577271 -168.000030517578
		 50.00012207031 463.88577271 -126.99998474 50.32836914 463.88577271 -125.99998474
		 50.00012207031 463.88577271 -124.99998474 50.00012207031 463.88577271 -79.99996948
		 50.00012207031 463.88577271 47.37600708 50.00012207031 463.88577271 50 50 175.96736145 50
		 50 175.96736145 47.37600708 50 175.96736145 -79.99996948 50 175.96736145 -124.99998474
		 50.32836914 175.96736145 -125.99998474 50 175.96736145 -126.99998474 50 175.96736145 -168.000030517578
		 50.32836914 175.96736145 -169.000030517578 50 175.96736145 -170.000030517578 50 175.96736145 -215.000061035156
		 50 175.96736145 -671 -358 175.96736145 -671 -382 175.96736145 -671 -667 175.96736145 -671
		 -667 175.96736145 -215.000061035156 -667 175.96736145 -170.000030517578 -667 175.96736145 -124.99998474
		 -667 175.96736145 -79.99996948 -667 175.96736145 47.37600708 -667 175.96736145 50
		 -667 175.96736145 193 -382 232 -342.3760376 -667 232 -342.3760376 -667 175.96736145 -342.3760376
		 -667 0 -342.3760376 -382 0 -342.3760376 -358 0 -342.3760376 50 0 -342.3760376 50 175.96736145 -342.3760376
		 50 232 -342.3760376 50 257 -342.3760376 50 418.88574219 -342.3760376 50.00012207031 463.88577271 -342.3760376
		 50 497 -342.3760376 -382 232 -477.37612915 -667 232 -477.37612915 -667 175.96736145 -477.37612915
		 -667 0 -477.37612915 -382 0 -477.37612915 -358 0 -477.37612915 50 0 -477.37612915
		 50 175.96736145 -477.37612915 50 232 -477.37612915 50 257 -477.37612915 50 418.88574219 -477.37612915
		 50.00012207031 463.88577271 -477.37612915 50 497 -477.37612915 -382 232 -604.7520752
		 -667 232 -604.7520752 -667 175.96736145 -604.7520752 -667 0 -604.7520752 -382 0 -604.7520752;
	setAttr ".vt[166:268]" -358 0 -604.7520752 50 0 -604.7520752 50 175.96736145 -604.7520752
		 50 232 -604.7520752 50 257 -604.7520752 50 418.88574219 -604.7520752 50.00012207031 463.88577271 -604.7520752
		 50 497 -604.7520752 50 126.88366699 50 50 126.88366699 47.37600708 50 126.88366699 -79.99996948
		 50 126.88366699 -124.99998474 50.32836914 127.38366699 -125.99998474 50 127.88366699 -126.99998474
		 50 127.88366699 -168.000030517578 50.32836914 127.38366699 -169.000030517578 50 126.88366699 -170.000030517578
		 50 126.88366699 -215.000061035156 50 126.88366699 -342.3760376 50 126.88366699 -477.37612915
		 50 126.88366699 -604.7520752 50 126.88366699 -671 -358 126.88366699 -671 -382 126.88366699 -671
		 -667 126.88366699 -671 -667 126.88366699 -604.7520752 -667 126.88366699 -477.37612915
		 -667 126.88366699 -342.3760376 -667 126.88366699 -215.000061035156 -667 126.88366699 -170.000030517578
		 -667 126.88366699 -124.99998474 -667 126.88366699 -79.99996948 -667 126.88366699 47.37600708
		 -667 126.88366699 50 -667 126.88366699 193 -143.62390137 0 50 -143.62390137 0 47.37600708
		 -143.62390137 0 -79.99996948 -143.62390137 0 -124.99998474 -143.62390137 0 -170.000030517578
		 -143.62390137 0 -215.000061035156 -143.62390137 0 -342.3760376 -143.62390137 0 -477.37612915
		 -143.62390137 0 -604.7520752 -143.62390137 0 -671 -143.62390137 126.88366699 -671
		 -143.62390137 175.96736145 -671 -143.62390137 232 -671 -143.62390137 257 -671 -143.62390137 418.88574219 -671
		 -143.62390137 463.88577271 -671 -143.62390137 497 -671 -16.2479248 497 -671 -16.2479248 463.88577271 -671
		 -16.2479248 418.88574219 -671 -16.2479248 257 -671 -16.2479248 232 -671 -16.2479248 175.96736145 -671
		 -16.2479248 126.88366699 -671 -16.2479248 0 -671 -16.2479248 0 -604.7520752 -16.2479248 0 -477.37612915
		 -16.2479248 0 -342.3760376 -16.2479248 0 -215.000061035156 -16.2479248 0 -170.000030517578
		 -16.2479248 0 -124.99998474 -16.2479248 0 -79.99996948 -16.2479248 0 47.37600708
		 -16.2479248 0 50 -188.95385742 0 50 -188.95385742 0 47.37600708 -188.95385742 0 -79.99996948
		 -188.95385742 0 -124.99998474 -188.95385742 0 -170.000030517578 -188.95385742 0 -215.000061035156
		 -188.95385742 0 -342.3760376 -188.95385742 0 -477.37612915 -188.95385742 0 -604.7520752
		 -188.95385742 0 -671 -188.95385742 126.88366699 -671 -188.95385742 175.96736145 -671
		 -188.95385742 232 -671 -188.95385742 257 -671 -188.95385742 418.88574219 -671 -188.95385742 463.88577271 -671
		 -188.95385742 497 -671 -316.32983398 0 50 -316.32983398 0 47.37600708 -316.32983398 0 -79.99996948
		 -316.32983398 0 -124.99998474 -316.32983398 0 -170.000030517578 -316.32983398 0 -215.000061035156
		 -316.32983398 0 -342.3760376 -316.32983398 0 -477.37612915 -316.32983398 0 -604.7520752
		 -316.32983398 0 -671 -316.32983398 126.88366699 -671 -316.32983398 175.96736145 -671
		 -316.32983398 232 -671 -316.32983398 257 -671 -316.32983398 418.88574219 -671 -316.32983398 463.88577271 -671
		 -316.32983398 497 -671;
	setAttr -s 499 ".ed";
	setAttr ".ed[0:165]"  0 252 0 0 42 1 1 41 0 2 261 0 0 4 1 2 5 0 4 43 1 4 6 1
		 5 7 0 6 44 0 1 174 0 3 187 0 8 39 0 2 188 1 10 265 0 5 189 1 7 190 0 6 199 0 8 90 0
		 9 100 0 11 38 0 10 101 0 13 268 0 0 14 0 4 15 1 14 15 1 6 16 0 15 16 1 14 17 0 15 18 1
		 17 18 0 16 19 0 18 19 0 16 200 0 20 8 0 21 9 0 22 10 0 20 40 1 21 222 1 22 23 0 23 24 0
		 24 162 0 25 26 0 25 27 1 23 161 0 26 28 0 27 28 0 29 64 0 30 63 0 31 62 1 32 61 0
		 33 60 1 34 59 1 35 58 0 36 45 0 37 46 0 29 111 1 30 31 0 31 116 0 32 232 1 33 34 1
		 34 35 1 35 197 1 36 37 1 38 29 0 41 32 0 42 33 1 43 34 1 44 35 0 45 25 0 46 27 0
		 38 112 1 39 40 0 40 115 0 41 233 1 42 43 1 43 44 1 44 198 1 45 46 1 47 56 0 48 57 0
		 49 83 0 50 84 1 51 85 1 52 86 0 53 87 1 54 88 0 55 89 0 47 48 1 48 129 1 49 50 1
		 50 51 1 51 256 1 52 182 1 53 54 1 54 98 1 56 37 0 57 36 0 58 49 0 59 50 1 60 51 1
		 61 52 0 64 55 0 56 57 1 57 130 1 58 59 1 59 60 1 60 255 1 61 177 1 62 63 1 63 93 1
		 52 65 1 53 66 1 65 181 1 61 67 1 67 65 1 62 68 1 67 178 1 54 69 1 66 69 1 63 70 1
		 68 70 1 55 71 1 69 97 1 64 72 1 70 94 1 72 71 1 65 73 1 66 74 1 73 180 1 67 75 1
		 75 73 1 68 76 1 75 179 1 76 74 1 69 77 1 74 77 1 70 78 1 76 78 1 78 77 0 71 79 1
		 77 96 1 72 80 1 78 95 1 80 79 1 81 47 0 82 48 0 83 138 0 84 139 1 85 140 1 86 141 0
		 89 147 0 81 82 1 82 128 1 83 84 1 84 85 1 85 257 1 86 183 1 87 88 0 88 99 0 90 113 0
		 91 39 0 92 30 0 93 110 1 94 109 1 95 108 1;
	setAttr ".ed[166:331]" 96 107 1 97 106 1 98 105 1 99 104 1 100 103 0 101 102 0
		 90 91 1 91 92 0 92 93 1 93 94 1 94 95 1 95 96 1 96 97 1 97 98 1 98 99 1 99 145 0
		 100 220 1 102 13 0 103 12 0 104 89 1 105 55 1 106 71 1 107 79 1 108 80 1 109 72 1
		 110 64 1 111 92 1 112 91 1 113 11 0 102 267 1 103 172 1 104 105 1 105 106 1 106 107 1
		 107 108 1 108 109 1 109 110 1 110 111 1 111 112 1 112 113 1 114 20 0 115 175 1 116 176 1
		 117 62 1 118 68 1 119 76 1 120 74 1 121 66 1 122 53 1 123 87 0 124 21 0 125 22 1
		 126 23 1 127 24 0 128 194 1 129 195 1 130 196 1 131 36 1 132 45 1 133 25 0 134 26 0
		 114 115 1 115 116 0 116 117 1 117 118 1 118 119 1 119 120 1 120 121 1 121 122 1 122 123 1
		 123 142 0 124 223 1 125 126 1 126 127 1 127 163 1 128 129 1 129 130 1 130 131 1 131 132 1
		 132 133 1 133 134 1 135 81 0 136 82 0 137 128 1 138 151 0 139 152 1 140 153 1 141 154 0
		 142 155 1 143 156 1 144 157 0 145 158 1 146 104 1 147 160 0 135 136 1 136 137 1 137 193 1
		 138 139 1 139 140 1 140 258 1 141 184 1 142 143 0 143 144 0 144 145 0 145 146 1 146 147 1
		 148 135 0 149 136 0 150 137 1 151 164 0 152 165 1 153 166 1 154 167 0 155 168 0 158 171 0
		 159 146 1 160 173 0 148 149 1 149 150 1 150 192 1 151 152 1 152 153 1 153 259 1 154 185 1
		 155 156 0 156 157 0 157 158 0 158 159 1 159 160 1 161 148 0 162 149 0 163 150 1 164 7 0
		 165 5 1 166 2 1 167 3 0 168 124 1 169 21 1 170 9 0 171 100 1 172 159 1 173 12 0 161 162 1
		 162 163 1 163 191 1 164 165 1 165 166 1 166 260 1 167 186 1 168 169 0 169 170 0 170 171 0
		 171 172 1 172 173 1 174 114 0 175 41 1 176 32 1 177 117 1 178 118 1 179 119 1 180 120 1
		 181 121 1 182 122 1 183 123 1 184 142 1 185 155 1;
	setAttr ".ed[332:497]" 186 168 1 187 124 0 188 125 1 189 126 1 190 127 0 191 164 1
		 192 151 1 193 138 1 194 83 1 195 49 1 196 58 1 197 131 1 198 132 1 199 133 0 200 134 0
		 174 175 1 175 176 1 176 177 1 177 178 1 178 179 1 179 180 1 180 181 1 181 182 1 182 183 1
		 183 184 1 184 185 1 185 186 1 186 187 1 187 224 1 188 189 1 189 190 1 190 191 1 191 192 1
		 192 193 1 193 194 1 194 195 1 195 196 1 196 197 1 197 198 1 198 199 1 199 200 1 201 234 0
		 202 236 1 203 237 1 204 231 1 205 230 1 206 229 1 207 228 1 208 227 1 209 226 1 210 225 0
		 211 245 1 212 246 1 213 247 1 215 249 1 216 219 1 217 218 0 201 202 1 202 203 1 203 204 1
		 204 205 1 205 206 1 206 207 1 207 208 1 208 209 1 209 210 1 210 211 1 211 212 0 212 213 0
		 213 214 0 214 215 0 215 216 1 216 217 1 218 12 0 219 103 1 220 215 0 221 9 0 224 211 0
		 225 3 0 226 167 1 227 154 1 228 141 1 229 86 1 230 52 1 231 61 1 232 203 1 233 202 1
		 234 1 0 218 219 1 219 220 1 220 221 0 221 222 0 222 223 0 223 224 0 224 225 1 225 226 1
		 226 227 1 227 228 1 228 229 1 229 230 1 230 231 1 231 232 1 232 233 1 233 234 1 235 201 0
		 236 253 1 237 254 1 238 204 1 239 205 1 240 206 1 241 207 1 242 208 1 243 209 1 244 210 0
		 245 262 0 248 214 0 249 266 0 250 216 1 251 217 0 235 236 1 236 237 1 237 238 1 238 239 1
		 239 240 1 240 241 1 241 242 1 242 243 1 243 244 1 244 245 1 245 246 0 246 247 0 247 248 0
		 248 249 0 249 250 1 250 251 1 252 235 0 253 42 1 254 33 1 255 238 1 256 239 1 257 240 1
		 258 241 1 259 242 1 260 243 1 261 244 0 262 188 1 263 125 1 264 22 1 266 101 1 267 250 1
		 268 251 0 252 253 1 253 254 1 254 255 1 255 256 1 256 257 1 257 258 1 258 259 1 259 260 1
		 260 261 1 261 262 1 262 263 0 263 264 0 264 265 0 265 266 0 266 267 1;
	setAttr ".ed[498]" 267 268 1;
	setAttr -s 226 -ch 904 ".fc[0:225]" -type "polyFaces" 
		f 4 0 483 468 -2
		mu 0 4 0 365 366 3
		f 4 1 75 -7 -5
		mu 0 4 4 5 6 7
		f 4 6 76 -10 -8
		mu 0 4 8 9 10 11
		f 4 347 321 -3 10
		mu 0 4 12 13 14 15
		f 4 3 492 477 -14
		mu 0 4 16 374 376 19
		f 4 -6 13 361 -16
		mu 0 4 20 21 22 23
		f 4 -9 15 362 -17
		mu 0 4 24 25 26 27
		f 4 9 77 371 -18
		mu 0 4 28 29 30 31
		f 4 172 161 -13 18
		mu 0 4 32 33 34 35
		f 4 14 496 480 -22
		mu 0 4 36 379 381 39
		f 4 4 24 -26 -24
		mu 0 4 40 41 42 43
		f 4 7 26 -28 -25
		mu 0 4 44 45 46 47
		f 4 25 29 -31 -29
		mu 0 4 48 49 50 51
		f 4 27 31 -33 -30
		mu 0 4 52 53 54 55
		f 4 -27 17 372 -34
		mu 0 4 56 57 58 59
		f 4 72 -38 34 12
		mu 0 4 60 61 62 63
		f 4 -480 495 -15 -37
		mu 0 4 64 378 380 67
		f 4 -70 78 70 -44
		mu 0 4 68 69 70 71
		f 4 -43 43 46 -46
		mu 0 4 72 73 74 75
		f 4 -305 317 305 -20
		mu 0 4 76 77 78 79
		f 4 -304 316 304 -36
		mu 0 4 80 81 82 83
		f 4 -302 314 359 -12
		mu 0 4 84 85 86 87
		f 4 313 491 -4 -301
		mu 0 4 88 373 375 91
		f 4 312 300 5 -300
		mu 0 4 92 93 94 95
		f 4 311 299 8 -299
		mu 0 4 96 97 98 99
		f 4 363 337 298 16
		mu 0 4 100 101 102 103
		f 4 308 -42 -41 44
		mu 0 4 104 105 106 107
		f 4 348 322 -66 -322
		mu 0 4 13 108 109 14
		f 4 -469 484 469 -67
		mu 0 4 3 366 367 111
		f 4 -76 66 60 -68
		mu 0 4 6 5 112 113
		f 4 -77 67 61 -69
		mu 0 4 10 9 114 115
		f 4 370 -78 68 62
		mu 0 4 116 30 29 117
		f 4 -79 -55 63 55
		mu 0 4 70 69 118 119
		f 4 103 -81 -89 79
		mu 0 4 120 121 122 123
		f 4 368 342 98 -342
		mu 0 4 124 125 126 127
		f 4 105 99 -91 -99
		mu 0 4 128 129 130 131
		f 4 106 100 -92 -100
		mu 0 4 132 133 134 135
		f 4 107 486 -93 -101
		mu 0 4 136 368 369 139
		f 4 352 -130 -132 133
		mu 0 4 140 141 142 143
		f 4 -137 -135 138 139
		mu 0 4 144 145 146 147
		f 4 177 -142 -140 143
		mu 0 4 148 149 150 151
		f 4 -64 -98 -104 96
		mu 0 4 119 118 121 120
		f 4 369 -63 53 -343
		mu 0 4 125 116 117 126
		f 4 -62 52 -106 -54
		mu 0 4 115 114 129 128
		f 4 -61 51 -107 -53
		mu 0 4 113 112 133 132
		f 4 -470 485 -108 -52
		mu 0 4 111 367 368 136
		f 4 349 -109 -51 -323
		mu 0 4 108 152 153 109
		f 4 -110 -50 -58 48
		mu 0 4 154 155 156 157
		f 4 174 -111 -49 -163
		mu 0 4 158 159 160 161
		f 4 354 -94 111 113
		mu 0 4 162 163 164 165
		f 4 -102 114 115 -112
		mu 0 4 164 153 166 165
		f 4 108 350 -118 -115
		mu 0 4 153 152 167 166
		f 4 -95 112 119 -119
		mu 0 4 168 169 170 171
		f 4 109 120 -122 -117
		mu 0 4 155 154 172 173
		f 4 179 -96 118 123
		mu 0 4 174 175 176 177
		f 4 110 175 -126 -121
		mu 0 4 160 159 178 179
		f 4 102 122 -127 -125
		mu 0 4 180 181 182 183
		f 4 353 -114 127 129
		mu 0 4 141 162 165 142
		f 4 -116 130 131 -128
		mu 0 4 165 166 143 142
		f 4 117 351 -134 -131
		mu 0 4 166 167 140 143
		f 4 -120 128 136 -136
		mu 0 4 171 170 145 144
		f 4 121 137 -139 -133
		mu 0 4 173 172 147 146
		f 4 178 -124 135 141
		mu 0 4 149 174 177 150
		f 4 125 176 -144 -138
		mu 0 4 179 178 148 151
		f 4 126 140 -145 -143
		mu 0 4 183 182 184 185
		f 4 88 -147 -153 145
		mu 0 4 123 122 186 187
		f 4 367 341 81 -341
		mu 0 4 188 124 127 189
		f 4 90 82 -155 -82
		mu 0 4 131 130 190 191
		f 4 91 83 -156 -83
		mu 0 4 135 134 192 193
		f 4 92 487 -157 -84
		mu 0 4 139 369 370 195
		f 4 355 -158 -85 93
		mu 0 4 163 196 197 164
		f 4 -159 -86 94 86
		mu 0 4 198 199 169 168
		f 4 180 -160 -87 95
		mu 0 4 175 200 201 176
		f 4 71 205 194 20
		mu 0 4 202 203 204 205
		f 4 56 204 -72 64
		mu 0 4 206 207 203 202
		f 4 -192 203 -57 47
		mu 0 4 180 208 207 206
		f 4 202 191 124 -191
		mu 0 4 209 208 180 183
		f 4 201 190 142 -190
		mu 0 4 210 209 183 185
		f 4 -189 200 189 144
		mu 0 4 184 211 210 185
		f 4 -188 199 188 -141
		mu 0 4 182 212 211 184
		f 4 -187 198 187 -123
		mu 0 4 181 213 212 182
		f 4 -186 197 186 87
		mu 0 4 214 215 213 181
		f 4 196 319 307 -185
		mu 0 4 216 217 218 219
		f 4 195 498 -23 -184
		mu 0 4 220 382 383 223
		f 4 -481 497 -196 -172
		mu 0 4 39 381 382 220
		f 4 -306 318 -197 -171
		mu 0 4 79 78 217 216
		f 4 -198 -170 -181 168
		mu 0 4 213 215 200 175
		f 4 -199 -169 -180 167
		mu 0 4 212 213 175 174
		f 4 -200 -168 -179 166
		mu 0 4 211 212 174 149
		f 4 -201 -167 -178 165
		mu 0 4 210 211 149 148
		f 4 -177 164 -202 -166
		mu 0 4 148 178 209 210
		f 4 -176 163 -203 -165
		mu 0 4 178 159 208 209
		f 4 -204 -164 -175 -193
		mu 0 4 207 208 159 158
		f 4 -205 192 -174 -194
		mu 0 4 203 207 158 33
		f 4 -206 193 -173 160
		mu 0 4 204 203 33 32
		f 4 73 -228 206 37
		mu 0 4 61 224 225 62
		f 4 -210 -230 -59 49
		mu 0 4 155 226 227 156
		f 4 -231 209 116 -211
		mu 0 4 228 226 155 173
		f 4 -232 210 132 -212
		mu 0 4 229 228 173 146
		f 4 -213 -233 211 134
		mu 0 4 145 230 229 146
		f 4 -214 -234 212 -129
		mu 0 4 170 231 230 145
		f 4 -215 -235 213 -113
		mu 0 4 169 232 231 170
		f 4 -216 -236 214 85
		mu 0 4 199 233 232 169
		f 4 -303 315 303 -217
		mu 0 4 234 235 81 80
		f 4 -479 494 479 -218
		mu 0 4 236 377 378 64
		f 4 -239 217 39 -219
		mu 0 4 238 239 240 241
		f 4 -240 218 40 -220
		mu 0 4 242 243 244 245
		f 4 309 -241 219 41
		mu 0 4 246 247 248 249
		f 4 89 -242 -154 146
		mu 0 4 250 251 252 253
		f 4 104 -243 -90 80
		mu 0 4 254 255 251 250
		f 4 -224 -244 -105 97
		mu 0 4 256 257 255 254
		f 4 -225 -245 223 54
		mu 0 4 258 259 257 256
		f 4 -246 224 69 -226
		mu 0 4 260 259 258 261
		f 4 -247 225 42 -227
		mu 0 4 262 263 264 265
		f 4 152 -249 -261 247
		mu 0 4 187 186 266 267
		f 4 153 -250 -262 248
		mu 0 4 253 252 268 269
		f 4 -340 366 340 147
		mu 0 4 270 271 188 189
		f 4 154 148 -264 -148
		mu 0 4 191 190 272 273
		f 4 155 149 -265 -149
		mu 0 4 193 192 274 275
		f 4 156 488 -266 -150
		mu 0 4 195 370 371 277
		f 4 356 -267 -151 157
		mu 0 4 196 278 279 197
		f 4 -271 -182 169 -259
		mu 0 4 280 281 200 215
		f 4 -272 258 185 151
		mu 0 4 282 280 215 214
		f 4 260 -274 -284 272
		mu 0 4 267 266 283 284
		f 4 261 -275 -285 273
		mu 0 4 269 268 285 286
		f 4 -339 365 339 250
		mu 0 4 287 288 271 270
		f 4 263 251 -287 -251
		mu 0 4 273 272 289 290
		f 4 264 252 -288 -252
		mu 0 4 275 274 291 292
		f 4 265 489 -289 -253
		mu 0 4 277 371 372 294
		f 4 357 -290 -254 266
		mu 0 4 278 295 296 279
		f 4 -291 -255 267 255
		mu 0 4 297 298 299 300
		f 4 -292 -256 268 256
		mu 0 4 301 297 300 302
		f 4 -293 -257 269 257
		mu 0 4 303 304 305 281
		f 4 -294 -258 270 -282
		mu 0 4 306 303 281 280
		f 4 -295 281 271 259
		mu 0 4 307 306 280 282
		f 4 283 -297 -309 295
		mu 0 4 284 283 105 104
		f 4 284 -298 -310 296
		mu 0 4 286 285 247 246
		f 4 -338 364 338 275
		mu 0 4 102 101 288 287
		f 4 286 276 -312 -276
		mu 0 4 290 289 97 96
		f 4 287 277 -313 -277
		mu 0 4 292 291 93 92
		f 4 288 490 -314 -278
		mu 0 4 294 372 373 88
		f 4 358 -315 -279 289
		mu 0 4 295 86 85 296
		f 4 -319 -281 293 -307
		mu 0 4 217 78 303 306
		f 4 -320 306 294 282
		mu 0 4 218 217 306 307
		f 4 227 207 -348 320
		mu 0 4 225 224 13 12
		f 4 228 208 -349 -208
		mu 0 4 224 227 108 13
		f 4 229 -324 -350 -209
		mu 0 4 227 226 152 108
		f 4 -351 323 230 -325
		mu 0 4 167 152 226 228
		f 4 -352 324 231 -326
		mu 0 4 140 167 228 229
		f 4 232 -327 -353 325
		mu 0 4 229 230 141 140
		f 4 233 -328 -354 326
		mu 0 4 230 231 162 141
		f 4 234 -329 -355 327
		mu 0 4 231 232 163 162
		f 4 235 -330 -356 328
		mu 0 4 232 233 196 163
		f 4 -331 -357 329 236
		mu 0 4 299 278 196 233
		f 4 -332 -358 330 254
		mu 0 4 298 295 278 299
		f 4 -333 -359 331 279
		mu 0 4 235 86 295 298
		f 4 -360 332 302 -334
		mu 0 4 87 86 235 234
		f 4 -478 493 478 -335
		mu 0 4 19 376 377 236
		f 4 -362 334 238 -336
		mu 0 4 23 22 239 238
		f 4 -363 335 239 -337
		mu 0 4 27 26 243 242
		f 4 240 310 -364 336
		mu 0 4 248 247 101 100
		f 4 -365 -311 297 285
		mu 0 4 288 101 247 285
		f 4 -366 -286 274 262
		mu 0 4 271 288 285 268
		f 4 -367 -263 249 220
		mu 0 4 188 271 268 252
		f 4 241 221 -368 -221
		mu 0 4 252 251 124 188
		f 4 242 222 -369 -222
		mu 0 4 251 255 125 124
		f 4 243 -344 -370 -223
		mu 0 4 255 257 116 125
		f 4 244 -345 -371 343
		mu 0 4 257 259 30 116
		f 4 -372 344 245 -346
		mu 0 4 31 30 259 260
		f 4 -373 345 246 -347
		mu 0 4 59 58 263 262
		f 4 435 419 2 74
		mu 0 4 308 309 310 311
		f 4 434 -75 65 59
		mu 0 4 312 308 311 313
		f 4 433 -60 50 -417
		mu 0 4 314 312 313 315
		f 4 432 416 101 -416
		mu 0 4 316 314 315 317
		f 4 431 415 84 -415
		mu 0 4 318 316 317 319
		f 4 430 414 150 -414
		mu 0 4 320 318 319 321
		f 4 429 413 253 -413
		mu 0 4 322 320 321 323
		f 4 428 412 278 -412
		mu 0 4 324 322 323 325
		f 4 427 411 301 -411
		mu 0 4 326 324 325 327
		f 4 426 410 11 360
		mu 0 4 328 329 330 331
		f 4 425 -361 333 237
		mu 0 4 332 328 331 333
		f 4 424 -238 216 38
		mu 0 4 334 332 333 335
		f 4 423 -39 35 -409
		mu 0 4 336 334 335 337
		f 4 422 408 19 182
		mu 0 4 338 339 340 341
		f 4 421 -183 170 -407
		mu 0 4 342 338 341 343
		f 4 420 406 184 -406
		mu 0 4 344 342 343 345
		f 4 -405 387 -421 -389
		mu 0 4 222 221 342 344
		f 4 -404 -408 -422 -388
		mu 0 4 221 38 338 342
		f 4 -399 382 -427 409
		mu 0 4 18 17 329 328
		f 4 -398 381 -428 -383
		mu 0 4 90 89 324 326
		f 4 -397 380 -429 -382
		mu 0 4 89 293 322 324
		f 4 -396 379 -430 -381
		mu 0 4 293 276 320 322
		f 4 -395 378 -431 -380
		mu 0 4 276 194 318 320
		f 4 -394 377 -432 -379
		mu 0 4 194 138 316 318
		f 4 -393 376 -433 -378
		mu 0 4 138 137 314 316
		f 4 -392 -418 -434 -377
		mu 0 4 137 110 312 314
		f 4 -391 -419 -435 417
		mu 0 4 110 2 308 312
		f 4 -390 373 -436 418
		mu 0 4 2 1 309 308
		f 4 -452 436 389 374
		mu 0 4 347 346 1 2
		f 4 -453 -375 390 375
		mu 0 4 348 347 2 110
		f 4 -454 -376 391 -440
		mu 0 4 349 348 110 137
		f 4 -455 439 392 -441
		mu 0 4 350 349 137 138
		f 4 -456 440 393 -442
		mu 0 4 351 350 138 194
		f 4 -457 441 394 -443
		mu 0 4 352 351 194 276
		f 4 -458 442 395 -444
		mu 0 4 353 352 276 293
		f 4 -459 443 396 -445
		mu 0 4 354 353 293 89
		f 4 -460 444 397 -446
		mu 0 4 356 354 89 90
		f 4 -461 445 398 383
		mu 0 4 357 355 17 18
		f 4 -462 -384 399 384
		mu 0 4 358 357 18 237
		f 4 -463 -385 400 385
		mu 0 4 359 358 237 65
		f 4 -464 -386 401 -448
		mu 0 4 361 359 65 66
		f 4 -465 447 402 386
		mu 0 4 362 360 37 38
		f 4 -466 -387 403 -450
		mu 0 4 363 362 38 221
		f 4 -467 449 404 -451
		mu 0 4 364 363 221 222
		f 4 -484 467 451 437
		mu 0 4 366 365 346 347
		f 4 -485 -438 452 438
		mu 0 4 367 366 347 348
		f 4 -486 -439 453 -471
		mu 0 4 368 367 348 349
		f 4 -487 470 454 -472
		mu 0 4 369 368 349 350
		f 4 -488 471 455 -473
		mu 0 4 370 369 350 351
		f 4 -489 472 456 -474
		mu 0 4 371 370 351 352
		f 4 -490 473 457 -475
		mu 0 4 372 371 352 353
		f 4 -491 474 458 -476
		mu 0 4 373 372 353 354
		f 4 -492 475 459 -477
		mu 0 4 375 373 354 356
		f 4 -493 476 460 446
		mu 0 4 376 374 355 357
		f 4 -498 -449 465 -482
		mu 0 4 382 381 362 363
		f 4 -499 481 466 -483
		mu 0 4 383 382 363 364;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "polySurface47" -p "group11";
	rename -uid "B215AACB-4ECC-6EEA-5540-209127553AA3";
	setAttr ".t" -type "double3" 1113.5 -257 175 ;
	setAttr ".rp" -type "double3" -16.2479248046875 126.8836669921875 -679 ;
	setAttr ".sp" -type "double3" -16.2479248046875 126.8836669921875 -679 ;
createNode mesh -n "polySurfaceShape80" -p "polySurface47";
	rename -uid "FEC742CB-4220-AE21-EEF5-059DDD3A3B44";
	setAttr -k off ".v";
	setAttr -s 2 ".iog[0].og";
	setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[24:139]";
	setAttr ".iog[0].og[3].gcl" -type "componentList" 1 "f[0:23]";
	setAttr ".vir" yes;
	setAttr ".vif" yes;
	setAttr -s 5 ".gtag";
	setAttr ".gtag[0].gtagnm" -type "string" "back";
	setAttr ".gtag[0].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[1].gtagnm" -type "string" "front";
	setAttr ".gtag[1].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[2].gtagnm" -type "string" "left";
	setAttr ".gtag[2].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[3].gtagnm" -type "string" "right";
	setAttr ".gtag[3].gtagcmp" -type "componentList" 0;
	setAttr ".gtag[4].gtagnm" -type "string" "rim";
	setAttr ".gtag[4].gtagcmp" -type "componentList" 0;
	setAttr ".pv" -type "double2" 0.5 0.5 ;
	setAttr ".uvst[0].uvsn" -type "string" "map1";
	setAttr -s 211 ".uvst[0].uvsp[0:210]" -type "float2" 0.5 0.5 0.75 0.5
		 0.5 0.125 0.75 0.125 0.6875 0.5 0.6875 0.125 0.62500006 0.5 0.62500006 0.125 0.5625
		 0.5 0.5625 0.125 0.75 0.43749988 0.6875 0.43749988 0.62500006 0.43749988 0.5625 0.43749988
		 0.5 0.43749988 0.75 0.37499991 0.6875 0.37499991 0.62500006 0.37499991 0.5625 0.37499991
		 0.5 0.37499991 0.75 0.31249994 0.6875 0.31249994 0.62500006 0.31249994 0.5625 0.31249994
		 0.5 0.31249994 0.75 0.25 0.6875 0.25 0.625 0.25 0.5625 0.25 0.5 0.25 0.75 0.1875
		 0.6875 0.1875 0.625 0.1875 0.5625 0.1875 0.5 0.1875 0.75 0.1875 0.6875 0.1875 0.6875
		 0.125 0.75 0.125 0.6875 0.1875 0.625 0.1875 0.62500006 0.125 0.6875 0.125 0.625 0.1875
		 0.5625 0.1875 0.5625 0.125 0.62500006 0.125 0.5625 0.1875 0.5 0.1875 0.5 0.125 0.5625
		 0.125 0.6875 0.5 0.6875 0.43749988 0.75 0.43749988 0.75 0.5 0.62500006 0.5 0.62500006
		 0.43749988 0.6875 0.43749988 0.6875 0.5 0.5625 0.5 0.5625 0.43749988 0.62500006 0.43749988
		 0.62500006 0.5 0.5 0.5 0.5 0.43749988 0.5625 0.43749988 0.5625 0.5 0.75 0.43749988
		 0.6875 0.43749988 0.6875 0.37499991 0.75 0.37499991 0.6875 0.43749988 0.62500006
		 0.43749988 0.62500006 0.37499991 0.6875 0.37499991 0.62500006 0.43749988 0.5625 0.43749988
		 0.5625 0.37499991 0.62500006 0.37499991 0.5625 0.43749988 0.5 0.43749988 0.5 0.37499991
		 0.5625 0.37499991 0.75 0.37499991 0.6875 0.37499991 0.6875 0.31249994 0.75 0.31249994
		 0.6875 0.37499991 0.62500006 0.37499991 0.62500006 0.31249994 0.6875 0.31249994 0.62500006
		 0.37499991 0.5625 0.37499991 0.5625 0.31249994 0.62500006 0.31249994 0.5625 0.37499991
		 0.5 0.37499991 0.5 0.31249994 0.5625 0.31249994 0.75 0.31249994 0.6875 0.31249994
		 0.6875 0.25 0.75 0.25 0.6875 0.31249994 0.62500006 0.31249994 0.625 0.25 0.6875 0.25
		 0.62500006 0.31249994 0.5625 0.31249994 0.5625 0.25 0.625 0.25 0.5625 0.31249994
		 0.5 0.31249994 0.5 0.25 0.5625 0.25 0.75 0.25 0.6875 0.25 0.6875 0.1875 0.75 0.1875
		 0.6875 0.25 0.625 0.25 0.625 0.1875 0.6875 0.1875 0.625 0.25 0.5625 0.25 0.5625 0.1875
		 0.625 0.1875 0.5625 0.25 0.5 0.25 0.5 0.1875 0.5625 0.1875 0 0 1 0 1 1 0 1 0 0 1
		 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0
		 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1
		 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1
		 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1;
	setAttr ".cuvs" -type "string" "map1";
	setAttr ".dcc" -type "string" "Ambient+Diffuse";
	setAttr ".covm[0]"  0 1 1;
	setAttr ".cdvm[0]"  0 1 1;
	setAttr -s 21 ".pt";
	setAttr ".pt[131]" -type "float3" 0 0 8 ;
	setAttr ".pt[132]" -type "float3" 0 0 8 ;
	setAttr ".pt[133]" -type "float3" 0 0 8 ;
	setAttr ".pt[134]" -type "float3" 0 0 8 ;
	setAttr ".pt[135]" -type "float3" 0 0 8 ;
	setAttr ".pt[136]" -type "float3" 0 0 8 ;
	setAttr ".pt[137]" -type "float3" 0 0 8 ;
	setAttr ".pt[138]" -type "float3" 0 0 8 ;
	setAttr ".pt[139]" -type "float3" 0 0 8 ;
	setAttr ".pt[140]" -type "float3" 0 0 8 ;
	setAttr ".pt[141]" -type "float3" 0 0 8 ;
	setAttr ".pt[142]" -type "float3" 0 0 8 ;
	setAttr ".pt[143]" -type "float3" 0 0 8 ;
	setAttr ".pt[144]" -type "float3" 0 0 8 ;
	setAttr ".pt[145]" -type "float3" 0 0 8 ;
	setAttr ".pt[146]" -type "float3" 0 0 8 ;
	setAttr ".pt[147]" -type "float3" 0 0 8 ;
	setAttr ".pt[148]" -type "float3" 0 0 8 ;
	setAttr ".pt[149]" -type "float3" 0 0 8 ;
	setAttr ".pt[150]" -type "float3" 0 0 8 ;
	setAttr -s 151 ".vt[0:150]"  -143.62390137 418.88574219 -679 -16.2479248 418.88574219 -679
		 -143.62390137 126.88366699 -679 -16.2479248 126.88366699 -679 -48.091918945 418.88574219 -679
		 -48.091918945 126.88366699 -679 -79.93591309 418.88574219 -679 -79.93591309 126.88366699 -679
		 -111.77990723 418.88574219 -679 -111.77990723 126.88366699 -679 -16.2479248 370.21862793 -679
		 -48.091918945 370.21862793 -679 -79.93591309 370.21862793 -679 -111.77990723 370.21862793 -679
		 -143.62390137 370.21862793 -679 -16.2479248 321.55163574 -679 -48.091918945 321.55163574 -679
		 -79.93591309 321.55163574 -679 -111.77990723 321.55163574 -679 -143.62390137 321.55163574 -679
		 -16.2479248 272.88464355 -679 -48.091918945 272.88464355 -679 -79.93591309 272.88464355 -679
		 -111.77990723 272.88464355 -679 -143.62390137 272.88464355 -679 -16.2479248 224.21769714 -679
		 -48.091918945 224.21769714 -679 -79.93591309 224.21769714 -679 -111.77990723 224.21769714 -679
		 -143.62390137 224.21769714 -679 -16.2479248 175.5506897 -679 -48.091918945 175.5506897 -679
		 -79.93591309 175.55067444 -679 -111.77990723 175.5506897 -679 -143.62390137 175.5506897 -679
		 -17.2479248 174.5506897 -680 -47.091918945 174.5506897 -680 -47.091918945 127.88366699 -680
		 -17.2479248 127.88366699 -680 -49.091918945 174.5506897 -680 -78.93591309 174.55067444 -680
		 -78.93591309 127.88366699 -680 -49.091918945 127.88366699 -680 -80.93591309 174.55067444 -680
		 -110.77990723 174.5506897 -680 -110.77990723 127.88366699 -680 -80.93591309 127.88366699 -680
		 -112.77990723 174.5506897 -680 -142.62390137 174.5506897 -680 -142.62390137 127.88366699 -680
		 -112.77990723 127.88366699 -680 -47.091918945 417.88574219 -680 -47.091918945 371.21862793 -680
		 -17.2479248 371.21862793 -680 -17.2479248 417.88574219 -680 -78.93591309 417.88574219 -680
		 -78.93591309 371.21862793 -680 -49.091918945 371.21862793 -680 -49.091918945 417.88574219 -680
		 -110.77990723 417.88574219 -680 -110.77990723 371.21862793 -680 -80.93591309 371.21862793 -680
		 -80.93591309 417.88574219 -680 -142.62390137 371.21862793 -680 -142.62390137 417.88574219 -680
		 -112.77990723 371.21862793 -680 -112.77990723 417.88574219 -680 -17.2479248 369.21862793 -680
		 -47.091918945 369.21862793 -680 -47.091918945 322.55163574 -680 -17.2479248 322.55163574 -680
		 -49.091918945 369.21862793 -680 -78.93591309 369.21862793 -680 -78.93591309 322.55163574 -680
		 -49.091918945 322.55163574 -680 -80.93591309 369.21862793 -680 -110.77990723 369.21862793 -680
		 -110.77990723 322.55163574 -680 -80.93591309 322.55163574 -680 -112.77990723 369.21862793 -680
		 -142.62390137 369.21862793 -680 -142.62390137 322.55163574 -680 -112.77990723 322.55163574 -680
		 -17.2479248 320.55163574 -680 -47.091918945 320.55163574 -680 -47.091918945 273.88464355 -680
		 -17.2479248 273.88464355 -680 -49.091918945 320.55163574 -680 -78.93591309 320.55163574 -680
		 -78.93591309 273.88464355 -680 -49.091918945 273.88464355 -680 -80.93591309 320.55163574 -680
		 -110.77990723 320.55163574 -680 -110.77990723 273.88464355 -680 -80.93591309 273.88464355 -680
		 -112.77990723 320.55163574 -680 -142.62390137 320.55163574 -680 -142.62390137 273.88464355 -680
		 -112.77990723 273.88464355 -680 -17.2479248 271.88464355 -680 -47.091918945 271.88464355 -680
		 -47.091918945 225.21769714 -680 -17.2479248 225.21769714 -680 -49.091918945 271.88464355 -680
		 -78.93591309 271.88464355 -680 -78.93591309 225.21769714 -680 -49.091918945 225.21769714 -680
		 -80.93591309 271.88464355 -680 -110.77990723 271.88464355 -680 -110.77990723 225.21769714 -680
		 -80.93591309 225.21769714 -680 -112.77990723 271.88464355 -680 -142.62390137 271.88464355 -680
		 -142.62390137 225.21769714 -680 -112.77990723 225.21769714 -680 -17.2479248 223.21769714 -680
		 -47.091918945 223.21769714 -680 -47.091918945 176.5506897 -680 -17.2479248 176.5506897 -680
		 -49.091918945 223.21769714 -680 -78.93591309 223.21769714 -680 -78.93591309 176.55067444 -680
		 -49.091918945 176.5506897 -680 -80.93591309 223.21769714 -680 -110.77990723 223.21769714 -680
		 -110.77990723 176.5506897 -680 -80.93591309 176.55067444 -680 -112.77990723 223.21769714 -680
		 -142.62390137 223.21769714 -680 -142.62390137 176.5506897 -680 -112.77990723 176.5506897 -680
		 -16.2479248 418.88574219 -679 -16.2479248 370.21862793 -679 -48.091918945 418.88574219 -679
		 -143.62390137 126.88366699 -679 -143.62390137 175.5506897 -679 -16.2479248 126.88366699 -679
		 -48.091918945 126.88366699 -679 -79.93591309 418.88574219 -679 -79.93591309 126.88366699 -679
		 -111.77990723 418.88574219 -679 -111.77990723 126.88366699 -679 -143.62390137 418.88574219 -679
		 -16.2479248 321.55163574 -679 -143.62390137 370.21862793 -679 -16.2479248 272.88464355 -679
		 -143.62390137 321.55163574 -679 -16.2479248 224.21769714 -679 -143.62390137 272.88464355 -679
		 -16.2479248 175.5506897 -679 -143.62390137 224.21769714 -679;
	setAttr -s 290 ".ed";
	setAttr ".ed[0:165]"  1 10 0 1 4 0 2 34 0 3 5 0 4 6 0 5 7 0 4 11 1 6 8 0
		 7 9 0 6 12 1 8 0 0 9 2 0 8 13 1 10 15 0 11 16 1 12 17 1 13 18 1 14 0 0 10 11 1 11 12 1
		 12 13 1 13 14 1 15 20 0 16 21 1 17 22 1 18 23 1 19 14 0 15 16 1 16 17 1 17 18 1 18 19 1
		 20 25 0 21 26 1 22 27 1 23 28 1 24 19 0 20 21 1 21 22 1 22 23 1 23 24 1 25 30 0 26 31 1
		 27 32 1 28 33 1 29 24 0 25 26 1 26 27 1 27 28 1 28 29 1 30 3 0 31 5 1 32 7 1 33 9 1
		 34 29 0 30 31 1 31 32 1 32 33 1 33 34 1 30 35 0 31 36 0 35 36 1 5 37 0 36 37 1 3 38 0
		 38 37 1 35 38 1 31 39 0 32 40 0 39 40 1 7 41 0 40 41 1 5 42 0 42 41 1 39 42 1 32 43 0
		 33 44 0 43 44 1 9 45 0 44 45 1 7 46 0 46 45 1 43 46 1 33 47 0 34 48 0 47 48 1 2 49 0
		 49 48 1 9 50 0 50 49 1 47 50 1 4 51 0 11 52 0 51 52 1 10 53 0 53 52 1 1 54 0 54 53 1
		 54 51 1 6 55 0 12 56 0 55 56 1 11 57 0 57 56 1 4 58 0 58 57 1 58 55 1 8 59 1 13 60 1
		 59 60 1 12 61 1 61 60 1 6 62 1 62 61 1 62 59 1 14 63 1 0 64 1 63 64 1 13 65 1 65 63 1
		 8 66 1 66 65 1 66 64 1 10 67 1 11 68 1 67 68 1 16 69 1 68 69 1 15 70 1 70 69 1 67 70 1
		 11 71 1 12 72 1 71 72 1 17 73 1 72 73 1 16 74 1 74 73 1 71 74 1 12 75 1 13 76 1 75 76 1
		 18 77 1 76 77 1 17 78 1 78 77 1 75 78 1 13 79 1 14 80 1 79 80 1 19 81 1 81 80 1 18 82 1
		 82 81 1 79 82 1 15 83 1 16 84 1 83 84 1 21 85 1 84 85 1 20 86 1 86 85 1 83 86 1 16 87 1
		 17 88 1 87 88 1 22 89 1;
	setAttr ".ed[166:289]" 88 89 1 21 90 1 90 89 1 87 90 1 17 91 1 18 92 1 91 92 1
		 23 93 1 92 93 1 22 94 1 94 93 1 91 94 1 18 95 1 19 96 1 95 96 1 24 97 1 97 96 1 23 98 1
		 98 97 1 95 98 1 20 99 1 21 100 1 99 100 1 26 101 1 100 101 1 25 102 1 102 101 1 99 102 1
		 21 103 1 22 104 1 103 104 1 27 105 1 104 105 1 26 106 1 106 105 1 103 106 1 22 107 1
		 23 108 1 107 108 1 28 109 1 108 109 1 27 110 1 110 109 1 107 110 1 23 111 1 24 112 1
		 111 112 1 29 113 1 113 112 1 28 114 1 114 113 1 111 114 1 25 115 1 26 116 1 115 116 1
		 31 117 1 116 117 1 30 118 1 118 117 1 115 118 1 26 119 1 27 120 1 119 120 1 32 121 1
		 120 121 1 31 122 1 122 121 1 119 122 1 27 123 1 28 124 1 123 124 1 33 125 1 124 125 1
		 32 126 1 126 125 1 123 126 1 28 127 1 29 128 1 127 128 1 34 129 1 129 128 1 33 130 1
		 130 129 1 127 130 1 1 131 0 10 132 0 131 132 0 4 133 0 131 133 0 2 134 0 34 135 0
		 134 135 0 3 136 0 5 137 0 136 137 0 6 138 0 133 138 0 7 139 0 137 139 0 8 140 0 138 140 0
		 9 141 0 139 141 0 0 142 0 140 142 0 141 134 0 15 143 0 132 143 0 14 144 0 144 142 0
		 20 145 0 143 145 0 19 146 0 146 144 0 25 147 0 145 147 0 24 148 0 148 146 0 30 149 0
		 147 149 0 29 150 0 150 148 0 149 136 0 135 150 0;
	setAttr -s 140 -ch 560 ".fc[0:139]" -type "polyFaces" 
		f 4 60 62 -65 -66
		mu 0 4 30 31 5 3
		f 4 68 70 -73 -74
		mu 0 4 31 32 7 5
		f 4 76 78 -81 -82
		mu 0 4 32 130 9 7
		f 4 84 -87 -89 -90
		mu 0 4 130 129 2 9
		f 4 92 -95 -97 97
		mu 0 4 4 11 10 1
		f 4 100 -103 -105 105
		mu 0 4 6 12 11 4
		f 4 108 -111 -113 113
		mu 0 4 8 13 12 6
		f 4 -117 -119 -121 121
		mu 0 4 0 14 13 8
		f 4 124 126 -129 -130
		mu 0 4 10 11 16 15
		f 4 132 134 -137 -138
		mu 0 4 11 12 17 16
		f 4 140 142 -145 -146
		mu 0 4 12 13 18 17
		f 4 148 -151 -153 -154
		mu 0 4 13 14 19 18
		f 4 156 158 -161 -162
		mu 0 4 15 16 21 20
		f 4 164 166 -169 -170
		mu 0 4 16 17 22 21
		f 4 172 174 -177 -178
		mu 0 4 17 18 23 22
		f 4 180 -183 -185 -186
		mu 0 4 18 19 24 23
		f 4 188 190 -193 -194
		mu 0 4 20 21 26 25
		f 4 196 198 -201 -202
		mu 0 4 21 22 27 26
		f 4 204 206 -209 -210
		mu 0 4 22 23 127 27
		f 4 212 -215 -217 -218
		mu 0 4 23 24 128 127
		f 4 220 222 -225 -226
		mu 0 4 25 26 31 30
		f 4 228 230 -233 -234
		mu 0 4 26 27 32 31
		f 4 236 238 -241 -242
		mu 0 4 27 127 130 32
		f 4 244 -247 -249 -250
		mu 0 4 127 128 129 130
		f 4 54 59 -61 -59
		mu 0 4 30 31 36 35
		f 4 50 61 -63 -60
		mu 0 4 31 5 37 36
		f 4 -4 63 64 -62
		mu 0 4 5 3 38 37
		f 4 -50 58 65 -64
		mu 0 4 3 30 35 38
		f 4 55 67 -69 -67
		mu 0 4 31 32 40 39
		f 4 51 69 -71 -68
		mu 0 4 32 7 41 40
		f 4 -6 71 72 -70
		mu 0 4 7 5 42 41
		f 4 -51 66 73 -72
		mu 0 4 5 31 39 42
		f 4 56 75 -77 -75
		mu 0 4 32 33 44 43
		f 4 52 77 -79 -76
		mu 0 4 33 9 45 44
		f 4 -9 79 80 -78
		mu 0 4 9 7 46 45
		f 4 -52 74 81 -80
		mu 0 4 7 32 43 46
		f 4 57 83 -85 -83
		mu 0 4 33 34 48 47
		f 4 -3 85 86 -84
		mu 0 4 34 2 49 48
		f 4 -12 87 88 -86
		mu 0 4 2 9 50 49
		f 4 -53 82 89 -88
		mu 0 4 9 33 47 50
		f 4 6 91 -93 -91
		mu 0 4 4 11 52 51
		f 4 -19 93 94 -92
		mu 0 4 11 10 53 52
		f 4 -1 95 96 -94
		mu 0 4 10 1 54 53
		f 4 1 90 -98 -96
		mu 0 4 1 4 51 54
		f 4 9 99 -101 -99
		mu 0 4 6 12 56 55
		f 4 -20 101 102 -100
		mu 0 4 12 11 57 56
		f 4 -7 103 104 -102
		mu 0 4 11 4 58 57
		f 4 4 98 -106 -104
		mu 0 4 4 6 55 58
		f 4 12 107 -109 -107
		mu 0 4 8 13 60 59
		f 4 -21 109 110 -108
		mu 0 4 13 12 61 60
		f 4 -10 111 112 -110
		mu 0 4 12 6 62 61
		f 4 7 106 -114 -112
		mu 0 4 6 8 59 62
		f 4 -18 114 116 -116
		mu 0 4 0 14 64 63
		f 4 -22 117 118 -115
		mu 0 4 14 13 65 64
		f 4 -13 119 120 -118
		mu 0 4 13 8 66 65
		f 4 10 115 -122 -120
		mu 0 4 8 0 63 66
		f 4 18 123 -125 -123
		mu 0 4 10 11 68 67
		f 4 14 125 -127 -124
		mu 0 4 11 16 69 68
		f 4 -28 127 128 -126
		mu 0 4 16 15 70 69
		f 4 -14 122 129 -128
		mu 0 4 15 10 67 70
		f 4 19 131 -133 -131
		mu 0 4 11 12 72 71
		f 4 15 133 -135 -132
		mu 0 4 12 17 73 72
		f 4 -29 135 136 -134
		mu 0 4 17 16 74 73
		f 4 -15 130 137 -136
		mu 0 4 16 11 71 74
		f 4 20 139 -141 -139
		mu 0 4 12 13 76 75
		f 4 16 141 -143 -140
		mu 0 4 13 18 77 76
		f 4 -30 143 144 -142
		mu 0 4 18 17 78 77
		f 4 -16 138 145 -144
		mu 0 4 17 12 75 78
		f 4 21 147 -149 -147
		mu 0 4 13 14 80 79
		f 4 -27 149 150 -148
		mu 0 4 14 19 81 80
		f 4 -31 151 152 -150
		mu 0 4 19 18 82 81
		f 4 -17 146 153 -152
		mu 0 4 18 13 79 82
		f 4 27 155 -157 -155
		mu 0 4 15 16 84 83
		f 4 23 157 -159 -156
		mu 0 4 16 21 85 84
		f 4 -37 159 160 -158
		mu 0 4 21 20 86 85
		f 4 -23 154 161 -160
		mu 0 4 20 15 83 86
		f 4 28 163 -165 -163
		mu 0 4 16 17 88 87
		f 4 24 165 -167 -164
		mu 0 4 17 22 89 88
		f 4 -38 167 168 -166
		mu 0 4 22 21 90 89
		f 4 -24 162 169 -168
		mu 0 4 21 16 87 90
		f 4 29 171 -173 -171
		mu 0 4 17 18 92 91
		f 4 25 173 -175 -172
		mu 0 4 18 23 93 92
		f 4 -39 175 176 -174
		mu 0 4 23 22 94 93
		f 4 -25 170 177 -176
		mu 0 4 22 17 91 94
		f 4 30 179 -181 -179
		mu 0 4 18 19 96 95
		f 4 -36 181 182 -180
		mu 0 4 19 24 97 96
		f 4 -40 183 184 -182
		mu 0 4 24 23 98 97
		f 4 -26 178 185 -184
		mu 0 4 23 18 95 98
		f 4 36 187 -189 -187
		mu 0 4 20 21 100 99
		f 4 32 189 -191 -188
		mu 0 4 21 26 101 100
		f 4 -46 191 192 -190
		mu 0 4 26 25 102 101
		f 4 -32 186 193 -192
		mu 0 4 25 20 99 102
		f 4 37 195 -197 -195
		mu 0 4 21 22 104 103
		f 4 33 197 -199 -196
		mu 0 4 22 27 105 104
		f 4 -47 199 200 -198
		mu 0 4 27 26 106 105
		f 4 -33 194 201 -200
		mu 0 4 26 21 103 106
		f 4 38 203 -205 -203
		mu 0 4 22 23 108 107
		f 4 34 205 -207 -204
		mu 0 4 23 28 109 108
		f 4 -48 207 208 -206
		mu 0 4 28 27 110 109
		f 4 -34 202 209 -208
		mu 0 4 27 22 107 110
		f 4 39 211 -213 -211
		mu 0 4 23 24 112 111
		f 4 -45 213 214 -212
		mu 0 4 24 29 113 112
		f 4 -49 215 216 -214
		mu 0 4 29 28 114 113
		f 4 -35 210 217 -216
		mu 0 4 28 23 111 114
		f 4 45 219 -221 -219
		mu 0 4 25 26 116 115
		f 4 41 221 -223 -220
		mu 0 4 26 31 117 116
		f 4 -55 223 224 -222
		mu 0 4 31 30 118 117
		f 4 -41 218 225 -224
		mu 0 4 30 25 115 118
		f 4 46 227 -229 -227
		mu 0 4 26 27 120 119
		f 4 42 229 -231 -228
		mu 0 4 27 32 121 120
		f 4 -56 231 232 -230
		mu 0 4 32 31 122 121
		f 4 -42 226 233 -232
		mu 0 4 31 26 119 122
		f 4 47 235 -237 -235
		mu 0 4 27 28 124 123
		f 4 43 237 -239 -236
		mu 0 4 28 33 125 124
		f 4 -57 239 240 -238
		mu 0 4 33 32 126 125
		f 4 -43 234 241 -240
		mu 0 4 32 27 123 126
		f 4 48 243 -245 -243
		mu 0 4 28 29 128 127
		f 4 -54 245 246 -244
		mu 0 4 29 34 129 128
		f 4 -58 247 248 -246
		mu 0 4 34 33 130 129
		f 4 -44 242 249 -248
		mu 0 4 33 28 127 130
		f 4 0 251 -253 -251
		mu 0 4 131 132 133 134
		f 4 -2 250 254 -254
		mu 0 4 135 136 137 138
		f 4 2 256 -258 -256
		mu 0 4 139 140 141 142
		f 4 3 259 -261 -259
		mu 0 4 143 144 145 146
		f 4 -5 253 262 -262
		mu 0 4 147 148 149 150
		f 4 5 263 -265 -260
		mu 0 4 151 152 153 154
		f 4 -8 261 266 -266
		mu 0 4 155 156 157 158
		f 4 8 267 -269 -264
		mu 0 4 159 160 161 162
		f 4 -11 265 270 -270
		mu 0 4 163 164 165 166
		f 4 11 255 -272 -268
		mu 0 4 167 168 169 170
		f 4 13 272 -274 -252
		mu 0 4 171 172 173 174
		f 4 17 269 -276 -275
		mu 0 4 175 176 177 178
		f 4 22 276 -278 -273
		mu 0 4 179 180 181 182
		f 4 26 274 -280 -279
		mu 0 4 183 184 185 186
		f 4 31 280 -282 -277
		mu 0 4 187 188 189 190
		f 4 35 278 -284 -283
		mu 0 4 191 192 193 194
		f 4 40 284 -286 -281
		mu 0 4 195 196 197 198
		f 4 44 282 -288 -287
		mu 0 4 199 200 201 202
		f 4 49 258 -289 -285
		mu 0 4 203 204 205 206
		f 4 53 286 -290 -257
		mu 0 4 207 208 209 210;
	setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 0 ;
	setAttr ".cvd" -type "dataPolyComponent" Index_Data Vertex 0 ;
	setAttr ".pd[0]" -type "dataPolyComponent" Index_Data UV 0 ;
	setAttr ".hfd" -type "dataPolyComponent" Index_Data Face 0 ;
createNode transform -n "pointLight1";
	rename -uid "00B273D8-493B-0567-4BF6-CD8DFC34BA3F";
	setAttr ".t" -type "double3" 1054.8191902595806 176.64149199025948 -154.71533299489775 ;
createNode pointLight -n "pointLightShape1" -p "pointLight1";
	rename -uid "C6A59002-4D11-0399-81B3-76867E6C120A";
	setAttr -k off ".v";
	setAttr ".in" 50000;
	setAttr ".de" 2;
	setAttr ".us" no;
createNode lightLinker -s -n "lightLinker1";
	rename -uid "E72AC6CC-45C6-822D-35B8-9D8A6BA7C236";
	setAttr -s 4 ".lnk";
	setAttr -s 4 ".slnk";
createNode shapeEditorManager -n "shapeEditorManager";
	rename -uid "7C58AB2F-4554-BE49-0828-1E81CC9DCB72";
createNode poseInterpolatorManager -n "poseInterpolatorManager";
	rename -uid "4EC5D833-4872-B67D-BDEE-AFBF52F95A95";
createNode displayLayerManager -n "layerManager";
	rename -uid "67436138-4DED-2010-7C88-1DA1008F7A56";
	setAttr ".cdl" 1;
	setAttr -s 2 ".dli[1]"  1;
	setAttr -s 2 ".dli";
createNode displayLayer -n "defaultLayer";
	rename -uid "44DA9418-4B4E-3FCB-FEC0-8C9E073C1180";
	setAttr ".ufem" -type "stringArray" 0  ;
createNode renderLayerManager -n "renderLayerManager";
	rename -uid "A779AFB8-4892-EBBE-E631-648F1788D4B7";
createNode renderLayer -n "defaultRenderLayer";
	rename -uid "8C2D51D2-4D27-F830-8FEE-58B0A4D8A0F6";
	setAttr ".g" yes;
createNode aiOptions -s -n "defaultArnoldRenderOptions";
	rename -uid "D8E8DA84-48E0-68F4-1969-96A2F84EB343";
	addAttr -ci true -sn "ARV_options" -ln "ARV_options" -dt "string";
	setAttr ".AA_samples" 2;
	setAttr ".AA_samples_max" 16;
	setAttr ".rndfb" 1;
	setAttr ".version" -type "string" "5.2.0";
createNode aiAOVFilter -s -n "defaultArnoldFilter";
	rename -uid "F9A5E257-4563-58C3-E2BF-74A485F1181B";
	setAttr ".ai_translator" -type "string" "gaussian";
createNode aiAOVDriver -s -n "defaultArnoldDriver";
	rename -uid "871B2EB6-47FD-1E0D-EDF1-388B72935B26";
	setAttr ".color_management" 1;
	setAttr ".ai_translator" -type "string" "png";
createNode aiAOVDriver -s -n "defaultArnoldDisplayDriver";
	rename -uid "51461222-418F-D8EB-ED40-928B54A15087";
	setAttr ".output_mode" 0;
	setAttr ".ai_translator" -type "string" "maya";
createNode script -n "uiConfigurationScriptNode";
	rename -uid "DF85B6D9-4EF8-4491-05EE-5DBE7203089C";
	setAttr ".b" -type "string" (
		"// Maya Mel UI Configuration File.\n//\n//  This script is machine generated.  Edit at your own risk.\n//\n//\n\nglobal string $gMainPane;\nif (`paneLayout -exists $gMainPane`) {\n\n\tglobal int $gUseScenePanelConfig;\n\tint    $useSceneConfig = $gUseScenePanelConfig;\n\tint    $nodeEditorPanelVisible = stringArrayContains(\"nodeEditorPanel1\", `getPanel -vis`);\n\tint    $nodeEditorWorkspaceControlOpen = (`workspaceControl -exists nodeEditorPanel1Window` && `workspaceControl -q -visible nodeEditorPanel1Window`);\n\tint    $menusOkayInPanels = `optionVar -q allowMenusInPanels`;\n\tint    $nVisPanes = `paneLayout -q -nvp $gMainPane`;\n\tint    $nPanes = 0;\n\tstring $editorName;\n\tstring $panelName;\n\tstring $itemFilterName;\n\tstring $panelConfig;\n\n\t//\n\t//  get current state of the UI\n\t//\n\tsceneUIReplacement -update $gMainPane;\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"modelPanel\" (localizedPanelLabel(\"Top View\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tmodelPanel -edit -l (localizedPanelLabel(\"Top View\")) -mbv $menusOkayInPanels  $panelName;\n"
		+ "\t\t$editorName = $panelName;\n        modelEditor -e \n            -camera \"|top\" \n            -useInteractiveMode 0\n            -displayLights \"default\" \n            -displayAppearance \"wireframe\" \n            -activeOnly 0\n            -ignorePanZoom 0\n            -wireframeOnShaded 0\n            -headsUpDisplay 1\n            -holdOuts 1\n            -selectionHiliteDisplay 1\n            -useDefaultMaterial 0\n            -bufferMode \"double\" \n            -twoSidedLighting 0\n            -backfaceCulling 0\n            -xray 0\n            -jointXray 0\n            -activeComponentsXray 0\n            -displayTextures 0\n            -smoothWireframe 0\n            -lineWidth 1\n            -textureAnisotropic 0\n            -textureHilight 1\n            -textureSampling 2\n            -textureDisplay \"modulate\" \n            -textureMaxSize 32768\n            -fogging 0\n            -fogSource \"fragment\" \n            -fogMode \"linear\" \n            -fogStart 0\n            -fogEnd 100\n            -fogDensity 0.1\n            -fogColor 0.5 0.5 0.5 1 \n"
		+ "            -depthOfFieldPreview 1\n            -maxConstantTransparency 1\n            -rendererName \"vp2Renderer\" \n            -objectFilterShowInHUD 1\n            -isFiltered 0\n            -colorResolution 256 256 \n            -bumpResolution 512 512 \n            -textureCompression 0\n            -transparencyAlgorithm \"frontAndBackCull\" \n            -transpInShadows 0\n            -cullingOverride \"none\" \n            -lowQualityLighting 0\n            -maximumNumHardwareLights 1\n            -occlusionCulling 0\n            -shadingModel 0\n            -useBaseRenderer 0\n            -useReducedRenderer 0\n            -smallObjectCulling 0\n            -smallObjectThreshold -1 \n            -interactiveDisableShadows 0\n            -interactiveBackFaceCull 0\n            -sortTransparent 1\n            -controllers 1\n            -nurbsCurves 1\n            -nurbsSurfaces 1\n            -polymeshes 1\n            -subdivSurfaces 1\n            -planes 1\n            -lights 1\n            -cameras 1\n            -controlVertices 1\n"
		+ "            -hulls 1\n            -grid 1\n            -imagePlane 1\n            -joints 1\n            -ikHandles 1\n            -deformers 1\n            -dynamics 1\n            -particleInstancers 1\n            -fluids 1\n            -hairSystems 1\n            -follicles 1\n            -nCloths 1\n            -nParticles 1\n            -nRigids 1\n            -dynamicConstraints 1\n            -locators 1\n            -manipulators 1\n            -pluginShapes 1\n            -dimensions 1\n            -handles 1\n            -pivots 1\n            -textures 1\n            -strokes 1\n            -motionTrails 1\n            -clipGhosts 1\n            -bluePencil 1\n            -greasePencils 0\n            -shadows 0\n            -captureSequenceNumber -1\n            -width 826\n            -height 519\n            -sceneRenderFilter 0\n            $editorName;\n        modelEditor -e -viewSelected 0 $editorName;\n        modelEditor -e \n            -pluginObjects \"gpuCacheDisplayFilter\" 1 \n            $editorName;\n\t\tif (!$useSceneConfig) {\n"
		+ "\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"modelPanel\" (localizedPanelLabel(\"Side View\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tmodelPanel -edit -l (localizedPanelLabel(\"Side View\")) -mbv $menusOkayInPanels  $panelName;\n\t\t$editorName = $panelName;\n        modelEditor -e \n            -camera \"|side\" \n            -useInteractiveMode 0\n            -displayLights \"default\" \n            -displayAppearance \"smoothShaded\" \n            -activeOnly 0\n            -ignorePanZoom 0\n            -wireframeOnShaded 0\n            -headsUpDisplay 1\n            -holdOuts 1\n            -selectionHiliteDisplay 1\n            -useDefaultMaterial 0\n            -bufferMode \"double\" \n            -twoSidedLighting 0\n            -backfaceCulling 0\n            -xray 0\n            -jointXray 0\n            -activeComponentsXray 0\n            -displayTextures 0\n            -smoothWireframe 0\n            -lineWidth 1\n            -textureAnisotropic 0\n            -textureHilight 1\n"
		+ "            -textureSampling 2\n            -textureDisplay \"modulate\" \n            -textureMaxSize 32768\n            -fogging 0\n            -fogSource \"fragment\" \n            -fogMode \"linear\" \n            -fogStart 0\n            -fogEnd 100\n            -fogDensity 0.1\n            -fogColor 0.5 0.5 0.5 1 \n            -depthOfFieldPreview 1\n            -maxConstantTransparency 1\n            -rendererName \"vp2Renderer\" \n            -objectFilterShowInHUD 1\n            -isFiltered 0\n            -colorResolution 256 256 \n            -bumpResolution 512 512 \n            -textureCompression 0\n            -transparencyAlgorithm \"frontAndBackCull\" \n            -transpInShadows 0\n            -cullingOverride \"none\" \n            -lowQualityLighting 0\n            -maximumNumHardwareLights 1\n            -occlusionCulling 0\n            -shadingModel 0\n            -useBaseRenderer 0\n            -useReducedRenderer 0\n            -smallObjectCulling 0\n            -smallObjectThreshold -1 \n            -interactiveDisableShadows 0\n"
		+ "            -interactiveBackFaceCull 0\n            -sortTransparent 1\n            -controllers 1\n            -nurbsCurves 1\n            -nurbsSurfaces 1\n            -polymeshes 1\n            -subdivSurfaces 1\n            -planes 1\n            -lights 1\n            -cameras 1\n            -controlVertices 1\n            -hulls 1\n            -grid 1\n            -imagePlane 1\n            -joints 1\n            -ikHandles 1\n            -deformers 1\n            -dynamics 1\n            -particleInstancers 1\n            -fluids 1\n            -hairSystems 1\n            -follicles 1\n            -nCloths 1\n            -nParticles 1\n            -nRigids 1\n            -dynamicConstraints 1\n            -locators 1\n            -manipulators 1\n            -pluginShapes 1\n            -dimensions 1\n            -handles 1\n            -pivots 1\n            -textures 1\n            -strokes 1\n            -motionTrails 1\n            -clipGhosts 1\n            -bluePencil 1\n            -greasePencils 0\n            -shadows 0\n            -captureSequenceNumber -1\n"
		+ "            -width 826\n            -height 519\n            -sceneRenderFilter 0\n            $editorName;\n        modelEditor -e -viewSelected 0 $editorName;\n        modelEditor -e \n            -pluginObjects \"gpuCacheDisplayFilter\" 1 \n            $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"modelPanel\" (localizedPanelLabel(\"Front View\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tmodelPanel -edit -l (localizedPanelLabel(\"Front View\")) -mbv $menusOkayInPanels  $panelName;\n\t\t$editorName = $panelName;\n        modelEditor -e \n            -camera \"|front\" \n            -useInteractiveMode 0\n            -displayLights \"default\" \n            -displayAppearance \"smoothShaded\" \n            -activeOnly 0\n            -ignorePanZoom 0\n            -wireframeOnShaded 0\n            -headsUpDisplay 1\n            -holdOuts 1\n            -selectionHiliteDisplay 1\n            -useDefaultMaterial 0\n            -bufferMode \"double\" \n"
		+ "            -twoSidedLighting 0\n            -backfaceCulling 0\n            -xray 0\n            -jointXray 0\n            -activeComponentsXray 0\n            -displayTextures 0\n            -smoothWireframe 0\n            -lineWidth 1\n            -textureAnisotropic 0\n            -textureHilight 1\n            -textureSampling 2\n            -textureDisplay \"modulate\" \n            -textureMaxSize 32768\n            -fogging 0\n            -fogSource \"fragment\" \n            -fogMode \"linear\" \n            -fogStart 0\n            -fogEnd 100\n            -fogDensity 0.1\n            -fogColor 0.5 0.5 0.5 1 \n            -depthOfFieldPreview 1\n            -maxConstantTransparency 1\n            -rendererName \"vp2Renderer\" \n            -objectFilterShowInHUD 1\n            -isFiltered 0\n            -colorResolution 256 256 \n            -bumpResolution 512 512 \n            -textureCompression 0\n            -transparencyAlgorithm \"frontAndBackCull\" \n            -transpInShadows 0\n            -cullingOverride \"none\" \n            -lowQualityLighting 0\n"
		+ "            -maximumNumHardwareLights 1\n            -occlusionCulling 0\n            -shadingModel 0\n            -useBaseRenderer 0\n            -useReducedRenderer 0\n            -smallObjectCulling 0\n            -smallObjectThreshold -1 \n            -interactiveDisableShadows 0\n            -interactiveBackFaceCull 0\n            -sortTransparent 1\n            -controllers 1\n            -nurbsCurves 1\n            -nurbsSurfaces 1\n            -polymeshes 1\n            -subdivSurfaces 1\n            -planes 1\n            -lights 1\n            -cameras 1\n            -controlVertices 1\n            -hulls 1\n            -grid 1\n            -imagePlane 1\n            -joints 1\n            -ikHandles 1\n            -deformers 1\n            -dynamics 1\n            -particleInstancers 1\n            -fluids 1\n            -hairSystems 1\n            -follicles 1\n            -nCloths 1\n            -nParticles 1\n            -nRigids 1\n            -dynamicConstraints 1\n            -locators 1\n            -manipulators 1\n            -pluginShapes 1\n"
		+ "            -dimensions 1\n            -handles 1\n            -pivots 1\n            -textures 1\n            -strokes 1\n            -motionTrails 1\n            -clipGhosts 1\n            -bluePencil 1\n            -greasePencils 0\n            -shadows 0\n            -captureSequenceNumber -1\n            -width 826\n            -height 519\n            -sceneRenderFilter 0\n            $editorName;\n        modelEditor -e -viewSelected 0 $editorName;\n        modelEditor -e \n            -pluginObjects \"gpuCacheDisplayFilter\" 1 \n            $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"modelPanel\" (localizedPanelLabel(\"Persp View\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tmodelPanel -edit -l (localizedPanelLabel(\"Persp View\")) -mbv $menusOkayInPanels  $panelName;\n\t\t$editorName = $panelName;\n        modelEditor -e \n            -camera \"|persp\" \n            -useInteractiveMode 0\n            -displayLights \"all\" \n"
		+ "            -displayAppearance \"smoothShaded\" \n            -activeOnly 0\n            -ignorePanZoom 0\n            -wireframeOnShaded 1\n            -headsUpDisplay 1\n            -holdOuts 1\n            -selectionHiliteDisplay 1\n            -useDefaultMaterial 0\n            -bufferMode \"double\" \n            -twoSidedLighting 0\n            -backfaceCulling 0\n            -xray 0\n            -jointXray 0\n            -activeComponentsXray 0\n            -displayTextures 1\n            -smoothWireframe 0\n            -lineWidth 1\n            -textureAnisotropic 0\n            -textureHilight 1\n            -textureSampling 2\n            -textureDisplay \"modulate\" \n            -textureMaxSize 32768\n            -fogging 0\n            -fogSource \"fragment\" \n            -fogMode \"linear\" \n            -fogStart 0\n            -fogEnd 100\n            -fogDensity 0.1\n            -fogColor 0.5 0.5 0.5 1 \n            -depthOfFieldPreview 1\n            -maxConstantTransparency 1\n            -rendererName \"vp2Renderer\" \n            -objectFilterShowInHUD 1\n"
		+ "            -isFiltered 0\n            -colorResolution 256 256 \n            -bumpResolution 512 512 \n            -textureCompression 0\n            -transparencyAlgorithm \"frontAndBackCull\" \n            -transpInShadows 0\n            -cullingOverride \"none\" \n            -lowQualityLighting 0\n            -maximumNumHardwareLights 1\n            -occlusionCulling 0\n            -shadingModel 0\n            -useBaseRenderer 0\n            -useReducedRenderer 0\n            -smallObjectCulling 0\n            -smallObjectThreshold -1 \n            -interactiveDisableShadows 0\n            -interactiveBackFaceCull 0\n            -sortTransparent 1\n            -controllers 1\n            -nurbsCurves 1\n            -nurbsSurfaces 1\n            -polymeshes 1\n            -subdivSurfaces 1\n            -planes 1\n            -lights 1\n            -cameras 1\n            -controlVertices 1\n            -hulls 1\n            -grid 1\n            -imagePlane 1\n            -joints 1\n            -ikHandles 1\n            -deformers 1\n            -dynamics 1\n"
		+ "            -particleInstancers 1\n            -fluids 1\n            -hairSystems 1\n            -follicles 1\n            -nCloths 1\n            -nParticles 1\n            -nRigids 1\n            -dynamicConstraints 1\n            -locators 1\n            -manipulators 1\n            -pluginShapes 1\n            -dimensions 1\n            -handles 1\n            -pivots 1\n            -textures 1\n            -strokes 1\n            -motionTrails 1\n            -clipGhosts 1\n            -bluePencil 1\n            -greasePencils 0\n            -shadows 1\n            -captureSequenceNumber -1\n            -width 1459\n            -height 1083\n            -sceneRenderFilter 0\n            $editorName;\n        modelEditor -e -viewSelected 0 $editorName;\n        modelEditor -e \n            -pluginObjects \"gpuCacheDisplayFilter\" 1 \n            $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"outlinerPanel\" (localizedPanelLabel(\"ToggledOutliner\")) `;\n\tif (\"\" != $panelName) {\n"
		+ "\t\t$label = `panel -q -label $panelName`;\n\t\toutlinerPanel -edit -l (localizedPanelLabel(\"ToggledOutliner\")) -mbv $menusOkayInPanels  $panelName;\n\t\t$editorName = $panelName;\n        outlinerEditor -e \n            -showShapes 0\n            -showAssignedMaterials 0\n            -showTimeEditor 1\n            -showReferenceNodes 1\n            -showReferenceMembers 1\n            -showAttributes 0\n            -showConnected 0\n            -showAnimCurvesOnly 0\n            -showMuteInfo 0\n            -organizeByLayer 1\n            -organizeByClip 1\n            -showAnimLayerWeight 1\n            -autoExpandLayers 1\n            -autoExpand 0\n            -showDagOnly 1\n            -showAssets 1\n            -showContainedOnly 1\n            -showPublishedAsConnected 0\n            -showParentContainers 0\n            -showContainerContents 1\n            -ignoreDagHierarchy 0\n            -expandConnections 0\n            -showUpstreamCurves 1\n            -showUnitlessCurves 1\n            -showCompounds 1\n            -showLeafs 1\n"
		+ "            -showNumericAttrsOnly 0\n            -highlightActive 1\n            -autoSelectNewObjects 0\n            -doNotSelectNewObjects 0\n            -dropIsParent 1\n            -transmitFilters 0\n            -setFilter \"defaultSetFilter\" \n            -showSetMembers 1\n            -allowMultiSelection 1\n            -alwaysToggleSelect 0\n            -directSelect 0\n            -isSet 0\n            -isSetMember 0\n            -displayMode \"DAG\" \n            -expandObjects 0\n            -setsIgnoreFilters 1\n            -containersIgnoreFilters 0\n            -editAttrName 0\n            -showAttrValues 0\n            -highlightSecondary 0\n            -showUVAttrsOnly 0\n            -showTextureNodesOnly 0\n            -attrAlphaOrder \"default\" \n            -animLayerFilterOptions \"allAffecting\" \n            -sortOrder \"none\" \n            -longNames 0\n            -niceNames 1\n            -showNamespace 1\n            -showPinIcons 0\n            -mapMotionTrails 0\n            -ignoreHiddenAttribute 0\n            -ignoreOutlinerColor 0\n"
		+ "            -renderFilterVisible 0\n            -renderFilterIndex 0\n            -selectionOrder \"chronological\" \n            -expandAttribute 0\n            $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"outlinerPanel\" (localizedPanelLabel(\"Outliner\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\toutlinerPanel -edit -l (localizedPanelLabel(\"Outliner\")) -mbv $menusOkayInPanels  $panelName;\n\t\t$editorName = $panelName;\n        outlinerEditor -e \n            -showShapes 0\n            -showAssignedMaterials 0\n            -showTimeEditor 1\n            -showReferenceNodes 0\n            -showReferenceMembers 0\n            -showAttributes 0\n            -showConnected 0\n            -showAnimCurvesOnly 0\n            -showMuteInfo 0\n            -organizeByLayer 1\n            -organizeByClip 1\n            -showAnimLayerWeight 1\n            -autoExpandLayers 1\n            -autoExpand 0\n            -showDagOnly 1\n            -showAssets 1\n"
		+ "            -showContainedOnly 1\n            -showPublishedAsConnected 0\n            -showParentContainers 0\n            -showContainerContents 1\n            -ignoreDagHierarchy 0\n            -expandConnections 0\n            -showUpstreamCurves 1\n            -showUnitlessCurves 1\n            -showCompounds 1\n            -showLeafs 1\n            -showNumericAttrsOnly 0\n            -highlightActive 1\n            -autoSelectNewObjects 0\n            -doNotSelectNewObjects 0\n            -dropIsParent 1\n            -transmitFilters 0\n            -setFilter \"defaultSetFilter\" \n            -showSetMembers 1\n            -allowMultiSelection 1\n            -alwaysToggleSelect 0\n            -directSelect 0\n            -displayMode \"DAG\" \n            -expandObjects 0\n            -setsIgnoreFilters 1\n            -containersIgnoreFilters 0\n            -editAttrName 0\n            -showAttrValues 0\n            -highlightSecondary 0\n            -showUVAttrsOnly 0\n            -showTextureNodesOnly 0\n            -attrAlphaOrder \"default\" \n"
		+ "            -animLayerFilterOptions \"allAffecting\" \n            -sortOrder \"none\" \n            -longNames 0\n            -niceNames 1\n            -showNamespace 1\n            -showPinIcons 0\n            -mapMotionTrails 0\n            -ignoreHiddenAttribute 0\n            -ignoreOutlinerColor 0\n            -renderFilterVisible 0\n            $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"graphEditor\" (localizedPanelLabel(\"Graph Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Graph Editor\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = ($panelName+\"OutlineEd\");\n            outlinerEditor -e \n                -showShapes 1\n                -showAssignedMaterials 0\n                -showTimeEditor 1\n                -showReferenceNodes 0\n                -showReferenceMembers 0\n                -showAttributes 1\n                -showConnected 1\n                -showAnimCurvesOnly 1\n"
		+ "                -showMuteInfo 0\n                -organizeByLayer 1\n                -organizeByClip 1\n                -showAnimLayerWeight 1\n                -autoExpandLayers 1\n                -autoExpand 1\n                -showDagOnly 0\n                -showAssets 1\n                -showContainedOnly 0\n                -showPublishedAsConnected 0\n                -showParentContainers 0\n                -showContainerContents 0\n                -ignoreDagHierarchy 0\n                -expandConnections 1\n                -showUpstreamCurves 1\n                -showUnitlessCurves 1\n                -showCompounds 0\n                -showLeafs 1\n                -showNumericAttrsOnly 1\n                -highlightActive 0\n                -autoSelectNewObjects 1\n                -doNotSelectNewObjects 0\n                -dropIsParent 1\n                -transmitFilters 1\n                -setFilter \"0\" \n                -showSetMembers 0\n                -allowMultiSelection 1\n                -alwaysToggleSelect 0\n                -directSelect 0\n"
		+ "                -displayMode \"DAG\" \n                -expandObjects 0\n                -setsIgnoreFilters 1\n                -containersIgnoreFilters 0\n                -editAttrName 0\n                -showAttrValues 0\n                -highlightSecondary 0\n                -showUVAttrsOnly 0\n                -showTextureNodesOnly 0\n                -attrAlphaOrder \"default\" \n                -animLayerFilterOptions \"allAffecting\" \n                -sortOrder \"none\" \n                -longNames 0\n                -niceNames 1\n                -showNamespace 1\n                -showPinIcons 1\n                -mapMotionTrails 1\n                -ignoreHiddenAttribute 0\n                -ignoreOutlinerColor 0\n                -renderFilterVisible 0\n                $editorName;\n\n\t\t\t$editorName = ($panelName+\"GraphEd\");\n            animCurveEditor -e \n                -displayValues 0\n                -snapTime \"integer\" \n                -snapValue \"none\" \n                -showPlayRangeShades \"on\" \n                -lockPlayRangeShades \"off\" \n"
		+ "                -smoothness \"fine\" \n                -resultSamples 1\n                -resultScreenSamples 0\n                -resultUpdate \"delayed\" \n                -showUpstreamCurves 1\n                -keyMinScale 1\n                -stackedCurvesMin -1\n                -stackedCurvesMax 1\n                -stackedCurvesSpace 0.2\n                -preSelectionHighlight 0\n                -constrainDrag 0\n                -valueLinesToggle 1\n                -highlightAffectedCurves 0\n                $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"dopeSheetPanel\" (localizedPanelLabel(\"Dope Sheet\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Dope Sheet\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = ($panelName+\"OutlineEd\");\n            outlinerEditor -e \n                -showShapes 1\n                -showAssignedMaterials 0\n                -showTimeEditor 1\n"
		+ "                -showReferenceNodes 0\n                -showReferenceMembers 0\n                -showAttributes 1\n                -showConnected 1\n                -showAnimCurvesOnly 1\n                -showMuteInfo 0\n                -organizeByLayer 1\n                -organizeByClip 1\n                -showAnimLayerWeight 1\n                -autoExpandLayers 1\n                -autoExpand 0\n                -showDagOnly 0\n                -showAssets 1\n                -showContainedOnly 0\n                -showPublishedAsConnected 0\n                -showParentContainers 0\n                -showContainerContents 0\n                -ignoreDagHierarchy 0\n                -expandConnections 1\n                -showUpstreamCurves 1\n                -showUnitlessCurves 0\n                -showCompounds 1\n                -showLeafs 1\n                -showNumericAttrsOnly 1\n                -highlightActive 0\n                -autoSelectNewObjects 0\n                -doNotSelectNewObjects 1\n                -dropIsParent 1\n                -transmitFilters 0\n"
		+ "                -setFilter \"0\" \n                -showSetMembers 0\n                -allowMultiSelection 1\n                -alwaysToggleSelect 0\n                -directSelect 0\n                -displayMode \"DAG\" \n                -expandObjects 0\n                -setsIgnoreFilters 1\n                -containersIgnoreFilters 0\n                -editAttrName 0\n                -showAttrValues 0\n                -highlightSecondary 0\n                -showUVAttrsOnly 0\n                -showTextureNodesOnly 0\n                -attrAlphaOrder \"default\" \n                -animLayerFilterOptions \"allAffecting\" \n                -sortOrder \"none\" \n                -longNames 0\n                -niceNames 1\n                -showNamespace 1\n                -showPinIcons 0\n                -mapMotionTrails 1\n                -ignoreHiddenAttribute 0\n                -ignoreOutlinerColor 0\n                -renderFilterVisible 0\n                $editorName;\n\n\t\t\t$editorName = ($panelName+\"DopeSheetEd\");\n            dopeSheetEditor -e \n                -displayValues 0\n"
		+ "                -snapTime \"integer\" \n                -snapValue \"none\" \n                -outliner \"dopeSheetPanel1OutlineEd\" \n                -showSummary 1\n                -showScene 0\n                -hierarchyBelow 0\n                -showTicks 1\n                -selectionWindow 0 0 0 0 \n                $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"timeEditorPanel\" (localizedPanelLabel(\"Time Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Time Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"clipEditorPanel\" (localizedPanelLabel(\"Trax Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Trax Editor\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = clipEditorNameFromPanel($panelName);\n"
		+ "            clipEditor -e \n                -displayValues 0\n                -snapTime \"none\" \n                -snapValue \"none\" \n                -initialized 0\n                -manageSequencer 0 \n                $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"sequenceEditorPanel\" (localizedPanelLabel(\"Camera Sequencer\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Camera Sequencer\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = sequenceEditorNameFromPanel($panelName);\n            clipEditor -e \n                -displayValues 0\n                -snapTime \"none\" \n                -snapValue \"none\" \n                -initialized 0\n                -manageSequencer 1 \n                $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"hyperGraphPanel\" (localizedPanelLabel(\"Hypergraph Hierarchy\")) `;\n"
		+ "\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Hypergraph Hierarchy\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = ($panelName+\"HyperGraphEd\");\n            hyperGraph -e \n                -graphLayoutStyle \"hierarchicalLayout\" \n                -orientation \"horiz\" \n                -mergeConnections 0\n                -zoom 1\n                -animateTransition 0\n                -showRelationships 1\n                -showShapes 0\n                -showDeformers 0\n                -showExpressions 0\n                -showConstraints 0\n                -showConnectionFromSelected 0\n                -showConnectionToSelected 0\n                -showConstraintLabels 0\n                -showUnderworld 0\n                -showInvisible 0\n                -transitionFrames 1\n                -opaqueContainers 0\n                -freeform 0\n                -imagePosition 0 0 \n                -imageScale 1\n                -imageEnabled 0\n                -graphType \"DAG\" \n"
		+ "                -heatMapDisplay 0\n                -updateSelection 1\n                -updateNodeAdded 1\n                -useDrawOverrideColor 0\n                -limitGraphTraversal -1\n                -range 0 0 \n                -iconSize \"smallIcons\" \n                -showCachedConnections 0\n                $editorName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"hyperShadePanel\" (localizedPanelLabel(\"Hypershade\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Hypershade\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"visorPanel\" (localizedPanelLabel(\"Visor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Visor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n"
		+ "\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"nodeEditorPanel\" (localizedPanelLabel(\"Node Editor\")) `;\n\tif ($nodeEditorPanelVisible || $nodeEditorWorkspaceControlOpen) {\n\t\tif (\"\" == $panelName) {\n\t\t\tif ($useSceneConfig) {\n\t\t\t\t$panelName = `scriptedPanel -unParent  -type \"nodeEditorPanel\" -l (localizedPanelLabel(\"Node Editor\")) -mbv $menusOkayInPanels `;\n\n\t\t\t$editorName = ($panelName+\"NodeEditorEd\");\n            nodeEditor -e \n                -allAttributes 0\n                -allNodes 0\n                -autoSizeNodes 1\n                -consistentNameSize 1\n                -createNodeCommand \"nodeEdCreateNodeCommand\" \n                -connectNodeOnCreation 0\n                -connectOnDrop 0\n                -copyConnectionsOnPaste 0\n                -connectionStyle \"bezier\" \n                -defaultPinnedState 0\n                -additiveGraphingMode 0\n                -connectedGraphingMode 1\n                -settingsChangedCallback \"nodeEdSyncControls\" \n                -traversalDepthLimit -1\n"
		+ "                -keyPressCommand \"nodeEdKeyPressCommand\" \n                -nodeTitleMode \"name\" \n                -gridSnap 0\n                -gridVisibility 1\n                -crosshairOnEdgeDragging 0\n                -popupMenuScript \"nodeEdBuildPanelMenus\" \n                -showNamespace 1\n                -showShapes 1\n                -showSGShapes 0\n                -showTransforms 1\n                -useAssets 1\n                -syncedSelection 1\n                -extendToShapes 1\n                -showUnitConversions 0\n                -editorMode \"default\" \n                -hasWatchpoint 0\n                $editorName;\n\t\t\t}\n\t\t} else {\n\t\t\t$label = `panel -q -label $panelName`;\n\t\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Node Editor\")) -mbv $menusOkayInPanels  $panelName;\n\n\t\t\t$editorName = ($panelName+\"NodeEditorEd\");\n            nodeEditor -e \n                -allAttributes 0\n                -allNodes 0\n                -autoSizeNodes 1\n                -consistentNameSize 1\n                -createNodeCommand \"nodeEdCreateNodeCommand\" \n"
		+ "                -connectNodeOnCreation 0\n                -connectOnDrop 0\n                -copyConnectionsOnPaste 0\n                -connectionStyle \"bezier\" \n                -defaultPinnedState 0\n                -additiveGraphingMode 0\n                -connectedGraphingMode 1\n                -settingsChangedCallback \"nodeEdSyncControls\" \n                -traversalDepthLimit -1\n                -keyPressCommand \"nodeEdKeyPressCommand\" \n                -nodeTitleMode \"name\" \n                -gridSnap 0\n                -gridVisibility 1\n                -crosshairOnEdgeDragging 0\n                -popupMenuScript \"nodeEdBuildPanelMenus\" \n                -showNamespace 1\n                -showShapes 1\n                -showSGShapes 0\n                -showTransforms 1\n                -useAssets 1\n                -syncedSelection 1\n                -extendToShapes 1\n                -showUnitConversions 0\n                -editorMode \"default\" \n                -hasWatchpoint 0\n                $editorName;\n\t\t\tif (!$useSceneConfig) {\n"
		+ "\t\t\t\tpanel -e -l $label $panelName;\n\t\t\t}\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"createNodePanel\" (localizedPanelLabel(\"Create Node\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Create Node\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"polyTexturePlacementPanel\" (localizedPanelLabel(\"UV Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"UV Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"renderWindowPanel\" (localizedPanelLabel(\"Render View\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Render View\")) -mbv $menusOkayInPanels  $panelName;\n"
		+ "\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"shapePanel\" (localizedPanelLabel(\"Shape Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tshapePanel -edit -l (localizedPanelLabel(\"Shape Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextPanel \"posePanel\" (localizedPanelLabel(\"Pose Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tposePanel -edit -l (localizedPanelLabel(\"Pose Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"dynRelEdPanel\" (localizedPanelLabel(\"Dynamic Relationships\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Dynamic Relationships\")) -mbv $menusOkayInPanels  $panelName;\n"
		+ "\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"relationshipPanel\" (localizedPanelLabel(\"Relationship Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Relationship Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"referenceEditorPanel\" (localizedPanelLabel(\"Reference Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Reference Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"dynPaintScriptedPanelType\" (localizedPanelLabel(\"Paint Effects\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Paint Effects\")) -mbv $menusOkayInPanels  $panelName;\n"
		+ "\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"scriptEditorPanel\" (localizedPanelLabel(\"Script Editor\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Script Editor\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"profilerPanel\" (localizedPanelLabel(\"Profiler Tool\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Profiler Tool\")) -mbv $menusOkayInPanels  $panelName;\n\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\t$panelName = `sceneUIReplacement -getNextScriptedPanel \"contentBrowserPanel\" (localizedPanelLabel(\"Content Browser\")) `;\n\tif (\"\" != $panelName) {\n\t\t$label = `panel -q -label $panelName`;\n\t\tscriptedPanel -edit -l (localizedPanelLabel(\"Content Browser\")) -mbv $menusOkayInPanels  $panelName;\n"
		+ "\t\tif (!$useSceneConfig) {\n\t\t\tpanel -e -l $label $panelName;\n\t\t}\n\t}\n\n\n\tif ($useSceneConfig) {\n        string $configName = `getPanel -cwl (localizedPanelLabel(\"Current Layout\"))`;\n        if (\"\" != $configName) {\n\t\t\tpanelConfiguration -edit -label (localizedPanelLabel(\"Current Layout\")) \n\t\t\t\t-userCreated false\n\t\t\t\t-defaultImage \"\"\n\t\t\t\t-image \"\"\n\t\t\t\t-sc false\n\t\t\t\t-configString \"global string $gMainPane; paneLayout -e -cn \\\"single\\\" -ps 1 100 100 $gMainPane;\"\n\t\t\t\t-removeAllPanels\n\t\t\t\t-ap false\n\t\t\t\t\t(localizedPanelLabel(\"Persp View\")) \n\t\t\t\t\t\"modelPanel\"\n"
		+ "\t\t\t\t\t\"$panelName = `modelPanel -unParent -l (localizedPanelLabel(\\\"Persp View\\\")) -mbv $menusOkayInPanels `;\\n$editorName = $panelName;\\nmodelEditor -e \\n    -cam `findStartUpCamera persp` \\n    -useInteractiveMode 0\\n    -displayLights \\\"all\\\" \\n    -displayAppearance \\\"smoothShaded\\\" \\n    -activeOnly 0\\n    -ignorePanZoom 0\\n    -wireframeOnShaded 1\\n    -headsUpDisplay 1\\n    -holdOuts 1\\n    -selectionHiliteDisplay 1\\n    -useDefaultMaterial 0\\n    -bufferMode \\\"double\\\" \\n    -twoSidedLighting 0\\n    -backfaceCulling 0\\n    -xray 0\\n    -jointXray 0\\n    -activeComponentsXray 0\\n    -displayTextures 1\\n    -smoothWireframe 0\\n    -lineWidth 1\\n    -textureAnisotropic 0\\n    -textureHilight 1\\n    -textureSampling 2\\n    -textureDisplay \\\"modulate\\\" \\n    -textureMaxSize 32768\\n    -fogging 0\\n    -fogSource \\\"fragment\\\" \\n    -fogMode \\\"linear\\\" \\n    -fogStart 0\\n    -fogEnd 100\\n    -fogDensity 0.1\\n    -fogColor 0.5 0.5 0.5 1 \\n    -depthOfFieldPreview 1\\n    -maxConstantTransparency 1\\n    -rendererName \\\"vp2Renderer\\\" \\n    -objectFilterShowInHUD 1\\n    -isFiltered 0\\n    -colorResolution 256 256 \\n    -bumpResolution 512 512 \\n    -textureCompression 0\\n    -transparencyAlgorithm \\\"frontAndBackCull\\\" \\n    -transpInShadows 0\\n    -cullingOverride \\\"none\\\" \\n    -lowQualityLighting 0\\n    -maximumNumHardwareLights 1\\n    -occlusionCulling 0\\n    -shadingModel 0\\n    -useBaseRenderer 0\\n    -useReducedRenderer 0\\n    -smallObjectCulling 0\\n    -smallObjectThreshold -1 \\n    -interactiveDisableShadows 0\\n    -interactiveBackFaceCull 0\\n    -sortTransparent 1\\n    -controllers 1\\n    -nurbsCurves 1\\n    -nurbsSurfaces 1\\n    -polymeshes 1\\n    -subdivSurfaces 1\\n    -planes 1\\n    -lights 1\\n    -cameras 1\\n    -controlVertices 1\\n    -hulls 1\\n    -grid 1\\n    -imagePlane 1\\n    -joints 1\\n    -ikHandles 1\\n    -deformers 1\\n    -dynamics 1\\n    -particleInstancers 1\\n    -fluids 1\\n    -hairSystems 1\\n    -follicles 1\\n    -nCloths 1\\n    -nParticles 1\\n    -nRigids 1\\n    -dynamicConstraints 1\\n    -locators 1\\n    -manipulators 1\\n    -pluginShapes 1\\n    -dimensions 1\\n    -handles 1\\n    -pivots 1\\n    -textures 1\\n    -strokes 1\\n    -motionTrails 1\\n    -clipGhosts 1\\n    -bluePencil 1\\n    -greasePencils 0\\n    -shadows 1\\n    -captureSequenceNumber -1\\n    -width 1459\\n    -height 1083\\n    -sceneRenderFilter 0\\n    $editorName;\\nmodelEditor -e -viewSelected 0 $editorName;\\nmodelEditor -e \\n    -pluginObjects \\\"gpuCacheDisplayFilter\\\" 1 \\n    $editorName\"\n"
		+ "\t\t\t\t\t\"modelPanel -edit -l (localizedPanelLabel(\\\"Persp View\\\")) -mbv $menusOkayInPanels  $panelName;\\n$editorName = $panelName;\\nmodelEditor -e \\n    -cam `findStartUpCamera persp` \\n    -useInteractiveMode 0\\n    -displayLights \\\"all\\\" \\n    -displayAppearance \\\"smoothShaded\\\" \\n    -activeOnly 0\\n    -ignorePanZoom 0\\n    -wireframeOnShaded 1\\n    -headsUpDisplay 1\\n    -holdOuts 1\\n    -selectionHiliteDisplay 1\\n    -useDefaultMaterial 0\\n    -bufferMode \\\"double\\\" \\n    -twoSidedLighting 0\\n    -backfaceCulling 0\\n    -xray 0\\n    -jointXray 0\\n    -activeComponentsXray 0\\n    -displayTextures 1\\n    -smoothWireframe 0\\n    -lineWidth 1\\n    -textureAnisotropic 0\\n    -textureHilight 1\\n    -textureSampling 2\\n    -textureDisplay \\\"modulate\\\" \\n    -textureMaxSize 32768\\n    -fogging 0\\n    -fogSource \\\"fragment\\\" \\n    -fogMode \\\"linear\\\" \\n    -fogStart 0\\n    -fogEnd 100\\n    -fogDensity 0.1\\n    -fogColor 0.5 0.5 0.5 1 \\n    -depthOfFieldPreview 1\\n    -maxConstantTransparency 1\\n    -rendererName \\\"vp2Renderer\\\" \\n    -objectFilterShowInHUD 1\\n    -isFiltered 0\\n    -colorResolution 256 256 \\n    -bumpResolution 512 512 \\n    -textureCompression 0\\n    -transparencyAlgorithm \\\"frontAndBackCull\\\" \\n    -transpInShadows 0\\n    -cullingOverride \\\"none\\\" \\n    -lowQualityLighting 0\\n    -maximumNumHardwareLights 1\\n    -occlusionCulling 0\\n    -shadingModel 0\\n    -useBaseRenderer 0\\n    -useReducedRenderer 0\\n    -smallObjectCulling 0\\n    -smallObjectThreshold -1 \\n    -interactiveDisableShadows 0\\n    -interactiveBackFaceCull 0\\n    -sortTransparent 1\\n    -controllers 1\\n    -nurbsCurves 1\\n    -nurbsSurfaces 1\\n    -polymeshes 1\\n    -subdivSurfaces 1\\n    -planes 1\\n    -lights 1\\n    -cameras 1\\n    -controlVertices 1\\n    -hulls 1\\n    -grid 1\\n    -imagePlane 1\\n    -joints 1\\n    -ikHandles 1\\n    -deformers 1\\n    -dynamics 1\\n    -particleInstancers 1\\n    -fluids 1\\n    -hairSystems 1\\n    -follicles 1\\n    -nCloths 1\\n    -nParticles 1\\n    -nRigids 1\\n    -dynamicConstraints 1\\n    -locators 1\\n    -manipulators 1\\n    -pluginShapes 1\\n    -dimensions 1\\n    -handles 1\\n    -pivots 1\\n    -textures 1\\n    -strokes 1\\n    -motionTrails 1\\n    -clipGhosts 1\\n    -bluePencil 1\\n    -greasePencils 0\\n    -shadows 1\\n    -captureSequenceNumber -1\\n    -width 1459\\n    -height 1083\\n    -sceneRenderFilter 0\\n    $editorName;\\nmodelEditor -e -viewSelected 0 $editorName;\\nmodelEditor -e \\n    -pluginObjects \\\"gpuCacheDisplayFilter\\\" 1 \\n    $editorName\"\n"
		+ "\t\t\t\t$configName;\n\n            setNamedPanelLayout (localizedPanelLabel(\"Current Layout\"));\n        }\n\n        panelHistory -e -clear mainPanelHistory;\n        sceneUIReplacement -clear;\n\t}\n\n\ngrid -spacing 10 -size 100 -divisions 1 -displayAxes yes -displayGridLines yes -displayDivisionLines yes -displayPerspectiveLabels no -displayOrthographicLabels no -displayAxesBold yes -perspectiveLabelPosition axis -orthographicLabelPosition edge;\nviewManip -drawCompass 0 -compassAngle 0 -frontParameters \"\" -homeParameters \"\" -selectionLockParameters \"\";\n}\n");
	setAttr ".st" 3;
createNode script -n "sceneConfigurationScriptNode";
	rename -uid "235D50D2-41D2-2601-DD6D-4797B0B51FE8";
	setAttr ".b" -type "string" "playbackOptions -min 1 -max 240 -ast 1 -aet 240 ";
	setAttr ".st" 6;
createNode groupId -n "groupId35";
	rename -uid "711FF922-4976-BE9E-B293-64BC3175E010";
	setAttr ".ihi" 0;
createNode groupId -n "groupId36";
	rename -uid "F27CF867-431B-D080-1C43-92A509D9134C";
	setAttr ".ihi" 0;
createNode shadingEngine -n "aiStandardSurface1SG";
	rename -uid "DD23343F-4FE1-2E93-C9EF-AD985E368209";
	setAttr ".ihi" 0;
	setAttr ".ro" yes;
createNode materialInfo -n "materialInfo1";
	rename -uid "E5A34EE7-478F-BC32-BCA2-BEAA24255703";
createNode blinn -n "M_Glass";
	rename -uid "A95AE32E-4607-C83C-8679-67BC92961CDD";
	setAttr ".c" -type "float3" 0 0 0 ;
	setAttr ".it" -type "float3" 1 1 1 ;
	setAttr ".sc" -type "float3" 0.23076923 0.23076923 0.23076923 ;
	setAttr ".ec" 0;
createNode shadingEngine -n "blinn1SG";
	rename -uid "B835006B-4049-5319-1EFC-54BDE077CDC6";
	setAttr ".ihi" 0;
	setAttr -s 14 ".dsm";
	setAttr ".ro" yes;
	setAttr -s 5 ".gn";
createNode materialInfo -n "materialInfo2";
	rename -uid "987B60BB-449F-9CAB-177B-BCB2B827961A";
createNode file -n "file1";
	rename -uid "DEBBC8CE-4E7C-6F33-FE57-D3A3BF2946A2";
	setAttr ".ftn" -type "string" "C:/Users/yuvan/Downloads/evening_road_01_puresky_2k.exr";
	setAttr ".cs" -type "string" "Raw";
createNode place2dTexture -n "place2dTexture1";
	rename -uid "0D3E276D-49AF-3B32-00EC-CAB4BBEC95E1";
createNode displayLayer -n "Skybox";
	rename -uid "1B6657B5-4AB3-77FA-F7CB-CA8110077AFC";
	setAttr ".dt" 2;
	setAttr ".ufem" -type "stringArray" 0  ;
	setAttr ".do" 1;
createNode nodeGraphEditorInfo -n "hyperShadePrimaryNodeEditorSavedTabsInfo";
	rename -uid "A2C02437-40B8-0EDE-40A7-679B1732694E";
	setAttr ".tgi[0].tn" -type "string" "Untitled_1";
	setAttr ".tgi[0].vl" -type "double2" -44.047617297323995 -323.80951094248985 ;
	setAttr ".tgi[0].vh" -type "double2" 604.76188073082676 44.047617297323995 ;
	setAttr -s 6 ".tgi[0].ni";
	setAttr ".tgi[0].ni[0].x" 360;
	setAttr ".tgi[0].ni[0].y" 42.857143402099609;
	setAttr ".tgi[0].ni[0].nvs" 1923;
	setAttr ".tgi[0].ni[1].x" 31.428571701049805;
	setAttr ".tgi[0].ni[1].y" -177.14285278320312;
	setAttr ".tgi[0].ni[1].nvs" 1923;
	setAttr ".tgi[0].ni[2].x" 187.14285278320312;
	setAttr ".tgi[0].ni[2].y" -68.571426391601562;
	setAttr ".tgi[0].ni[2].nvs" 1923;
	setAttr ".tgi[0].ni[3].x" -120;
	setAttr ".tgi[0].ni[3].y" -91.428573608398438;
	setAttr ".tgi[0].ni[3].nvs" 1923;
	setAttr ".tgi[0].ni[4].x" 338.57144165039062;
	setAttr ".tgi[0].ni[4].y" -177.14285278320312;
	setAttr ".tgi[0].ni[4].nvs" 1923;
	setAttr ".tgi[0].ni[5].x" 494.28570556640625;
	setAttr ".tgi[0].ni[5].y" -68.571426391601562;
	setAttr ".tgi[0].ni[5].nvs" 1923;
createNode groupId -n "groupId56";
	rename -uid "F4561611-4970-81CE-006B-78B27F7835D6";
	setAttr ".ihi" 0;
createNode groupId -n "groupId57";
	rename -uid "00BAFF1D-4D08-AA68-C48F-1C844646EF33";
	setAttr ".ihi" 0;
createNode groupId -n "groupId60";
	rename -uid "8309F870-484B-4A6F-A080-8F98C238E434";
	setAttr ".ihi" 0;
createNode groupId -n "groupId61";
	rename -uid "09E773C2-4245-64FD-2D0B-CA8CF675A814";
	setAttr ".ihi" 0;
createNode groupId -n "groupId62";
	rename -uid "40D2D438-448D-6BAB-3C26-12B2FC11C5CC";
	setAttr ".ihi" 0;
createNode groupId -n "groupId63";
	rename -uid "A9DC11E9-4F56-9588-531C-D3A22A37B08F";
	setAttr ".ihi" 0;
createNode groupId -n "groupId64";
	rename -uid "CF330CAF-4CDB-82AB-C8EA-E9AF67208F5E";
	setAttr ".ihi" 0;
createNode groupId -n "groupId65";
	rename -uid "E28F04D9-488F-6333-69C7-40A88D60FBA9";
	setAttr ".ihi" 0;
createNode groupId -n "groupId66";
	rename -uid "B87F8BD9-4300-4079-F26A-4B873FD3DB40";
	setAttr ".ihi" 0;
createNode groupId -n "groupId67";
	rename -uid "2E95FA62-4F0B-4BAC-17AB-4F936C9AFB02";
	setAttr ".ihi" 0;
createNode groupId -n "groupId68";
	rename -uid "1F656A10-42C6-0BFA-89D3-E982D5C2BFAF";
	setAttr ".ihi" 0;
createNode groupId -n "groupId76";
	rename -uid "2E74BD63-43F6-74B8-D4DE-C9A1CE1DB5F3";
	setAttr ".ihi" 0;
createNode groupId -n "groupId84";
	rename -uid "DBAD1313-47E0-7672-9696-79A9BC7634F6";
	setAttr ".ihi" 0;
createNode groupId -n "groupId86";
	rename -uid "22509559-4BBE-95AE-BA1B-B1B8EE9AD07F";
	setAttr ".ihi" 0;
createNode groupId -n "groupId87";
	rename -uid "2DB6D07B-4116-7A2C-D55D-7DB0CB08F9E7";
	setAttr ".ihi" 0;
createNode groupId -n "groupId88";
	rename -uid "D068E108-432E-257E-4214-30A88CF93993";
	setAttr ".ihi" 0;
createNode groupId -n "groupId89";
	rename -uid "EB0ABA2C-4E11-06FD-6476-409A2F617E24";
	setAttr ".ihi" 0;
createNode groupId -n "groupId90";
	rename -uid "B02E3723-454F-4F73-1EB8-A082CABBDADA";
	setAttr ".ihi" 0;
createNode groupId -n "groupId91";
	rename -uid "E7159160-440C-5099-9F71-7385349A4DAF";
	setAttr ".ihi" 0;
createNode groupId -n "groupId92";
	rename -uid "FF12E5D7-47B3-8397-0947-D39158ED1057";
	setAttr ".ihi" 0;
createNode groupId -n "groupId93";
	rename -uid "D8540230-44D1-0F08-EEA5-4F8A2F17A901";
	setAttr ".ihi" 0;
createNode groupId -n "groupId94";
	rename -uid "BC772F2D-44BD-13C5-9FC9-EBBA4E0EA7A6";
	setAttr ".ihi" 0;
createNode groupId -n "groupId95";
	rename -uid "5FB180DA-40A1-B141-6771-8FBE13D12BE3";
	setAttr ".ihi" 0;
createNode groupId -n "groupId96";
	rename -uid "AF30DB1C-470F-1BD5-1513-C98E0D622D93";
	setAttr ".ihi" 0;
createNode groupId -n "groupId97";
	rename -uid "7A497D88-49FB-E0E2-311C-469A3A4B9C46";
	setAttr ".ihi" 0;
createNode groupId -n "groupId98";
	rename -uid "7CEC945C-4F14-84E0-B9F5-8BBCC7F52510";
	setAttr ".ihi" 0;
createNode groupId -n "groupId99";
	rename -uid "80867750-4B79-2E72-D50D-EB978F391872";
	setAttr ".ihi" 0;
createNode groupId -n "groupId100";
	rename -uid "33878805-418C-9F65-5094-D1AB9DAF7BB0";
	setAttr ".ihi" 0;
createNode groupId -n "groupId101";
	rename -uid "6FBF33D1-4298-BD4A-07BE-DBA9A87FDF8F";
	setAttr ".ihi" 0;
createNode groupId -n "groupId112";
	rename -uid "DAA6E4D6-44E8-8EAF-AE59-348D33417A56";
	setAttr ".ihi" 0;
createNode groupId -n "groupId113";
	rename -uid "95BD40AF-4D56-543E-E38B-AAB930F3C1A3";
	setAttr ".ihi" 0;
createNode groupId -n "groupId114";
	rename -uid "F006D929-4D3C-CBD5-68ED-939D98547CA4";
	setAttr ".ihi" 0;
createNode groupId -n "groupId115";
	rename -uid "AFB3E489-4D5C-8F92-B0B9-AF89B3488B88";
	setAttr ".ihi" 0;
createNode groupId -n "groupId126";
	rename -uid "438612F7-47A9-89E6-7825-B48AD11FA6A9";
	setAttr ".ihi" 0;
createNode groupId -n "groupId127";
	rename -uid "1526FD85-4C22-7382-C321-888F25E9A9EB";
	setAttr ".ihi" 0;
createNode groupId -n "groupId128";
	rename -uid "43D9EC43-4FE6-75F5-1048-A0B0E2F690ED";
	setAttr ".ihi" 0;
createNode groupId -n "groupId129";
	rename -uid "26D89AE1-4766-20F3-3964-C48A4F32035E";
	setAttr ".ihi" 0;
createNode groupId -n "groupId130";
	rename -uid "33C2A430-4652-94CE-C1A3-4BBA1A6A4B21";
	setAttr ".ihi" 0;
createNode groupId -n "groupId131";
	rename -uid "863B4904-4F99-843D-0054-BDA8664018CD";
	setAttr ".ihi" 0;
createNode groupId -n "groupId132";
	rename -uid "BF363CD5-4F74-D867-374D-74ADEF0DA545";
	setAttr ".ihi" 0;
createNode groupId -n "groupId133";
	rename -uid "7BD20D1B-4E49-E661-914E-92950F84F4EF";
	setAttr ".ihi" 0;
createNode groupId -n "groupId134";
	rename -uid "70AC445C-4E71-11A8-99D3-68A86A9BB23A";
	setAttr ".ihi" 0;
select -ne :time1;
	setAttr ".o" 1;
	setAttr ".unw" 1;
select -ne :hardwareRenderingGlobals;
	setAttr ".otfna" -type "stringArray" 22 "NURBS Curves" "NURBS Surfaces" "Polygons" "Subdiv Surface" "Particles" "Particle Instance" "Fluids" "Strokes" "Image Planes" "UI" "Lights" "Cameras" "Locators" "Joints" "IK Handles" "Deformers" "Motion Trails" "Components" "Hair Systems" "Follicles" "Misc. UI" "Ornaments"  ;
	setAttr ".otfva" -type "Int32Array" 22 0 1 1 1 1 1
		 1 1 1 0 0 0 0 0 0 0 0 0
		 0 0 0 0 ;
	setAttr ".mhl" 16;
	setAttr ".ta" 0;
	setAttr ".ts" yes;
	setAttr ".aoon" yes;
	setAttr ".aoam" 1.25;
	setAttr ".aora" 8;
	setAttr ".aofr" 32;
	setAttr ".msaa" yes;
	setAttr ".fprt" yes;
select -ne :renderPartition;
	setAttr -s 4 ".st";
select -ne :renderGlobalsList1;
select -ne :defaultShaderList1;
	setAttr -s 6 ".s";
select -ne :postProcessList1;
	setAttr -s 2 ".p";
select -ne :defaultRenderUtilityList1;
select -ne :defaultRenderingList1;
select -ne :lightList1;
	setAttr -s 3 ".l";
select -ne :defaultTextureList1;
select -ne :initialShadingGroup;
	setAttr -s 45 ".dsm";
	setAttr ".ro" yes;
	setAttr -s 38 ".gn";
select -ne :initialParticleSE;
	setAttr ".ro" yes;
select -ne :defaultRenderGlobals;
	addAttr -ci true -h true -sn "dss" -ln "defaultSurfaceShader" -dt "string";
	setAttr ".ren" -type "string" "mayaHardware2";
	setAttr ".imfkey" -type "string" "png";
	setAttr ".dss" -type "string" "lambert1";
select -ne :defaultResolution;
	setAttr ".w" 1280;
	setAttr ".h" 720;
	setAttr ".pa" 1;
	setAttr ".dar" 1.7777777910232544;
select -ne :defaultLightSet;
	setAttr -s 3 ".dsm";
select -ne :defaultColorMgtGlobals;
	setAttr ".cfe" yes;
	setAttr ".cfp" -type "string" "<MAYA_RESOURCES>/OCIO-configs/Maya2022-default/config.ocio";
	setAttr ".vtn" -type "string" "ACES 1.0 SDR-video (sRGB)";
	setAttr ".vn" -type "string" "ACES 1.0 SDR-video";
	setAttr ".dn" -type "string" "sRGB";
	setAttr ".wsn" -type "string" "ACEScg";
	setAttr ".otn" -type "string" "ACES 1.0 SDR-video (sRGB)";
	setAttr ".potn" -type "string" "ACES 1.0 SDR-video (sRGB)";
select -ne :hardwareRenderGlobals;
	setAttr ".ctrs" 256;
	setAttr ".btrs" 512;
connectAttr "Skybox.di" "aiSkyDomeLight1.do";
connectAttr "file1.oc" "aiSkyDomeLightShape1.sc";
connectAttr "groupId56.id" "|group11|polySurface20|polySurfaceShape32.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface20|polySurfaceShape32.iog.og[0].gco"
		;
connectAttr "groupId126.id" "|group11|polySurface24|polySurfaceShape54.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface24|polySurfaceShape54.iog.og[0].gco"
		;
connectAttr "groupId91.id" "polySurfaceShape31.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape31.iog.og[0].gco";
connectAttr "groupId88.id" "|group11|polySurface28|polySurfaceShape28.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface28|polySurfaceShape28.iog.og[0].gco"
		;
connectAttr "groupId92.id" "|group11|polySurface32|polySurfaceShape32.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface32|polySurfaceShape32.iog.og[0].gco"
		;
connectAttr "groupId62.id" "polySurfaceShape8.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape8.iog.og[0].gco";
connectAttr "groupId127.id" "polySurfaceShape3.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape3.iog.og[0].gco";
connectAttr "groupId95.id" "polySurfaceShape35.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape35.iog.og[0].gco";
connectAttr "groupId86.id" "polySurfaceShape27.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape27.iog.og[0].gco";
connectAttr "groupId66.id" "|group11|polySurface9|polySurfaceShape9.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface9|polySurfaceShape9.iog.og[0].gco"
		;
connectAttr "groupId90.id" "polySurfaceShape30.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape30.iog.og[0].gco";
connectAttr "groupId100.id" "|group11|polySurface40|polySurfaceShape40.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface40|polySurfaceShape40.iog.og[0].gco"
		;
connectAttr "groupId63.id" "polySurfaceShape49.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape49.iog.og[0].gco";
connectAttr "groupId89.id" "polySurfaceShape29.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape29.iog.og[0].gco";
connectAttr "groupId57.id" "polySurfaceShape26.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape26.iog.og[0].gco";
connectAttr "groupId97.id" "polySurfaceShape37.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape37.iog.og[0].gco";
connectAttr "groupId67.id" "polySurfaceShape50.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape50.iog.og[0].gco";
connectAttr "groupId98.id" "polySurfaceShape38.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape38.iog.og[0].gco";
connectAttr "groupId36.id" "polySurfaceShape19.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape19.iog.og[0].gco";
connectAttr "groupId87.id" "polySurfaceShape61.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape61.iog.og[0].gco";
connectAttr "groupId65.id" "polySurfaceShape52.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape52.iog.og[0].gco";
connectAttr "groupId96.id" "polySurfaceShape36.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape36.iog.og[0].gco";
connectAttr "groupId61.id" "|group11|polySurface53|polySurfaceShape53.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface53|polySurfaceShape53.iog.og[0].gco"
		;
connectAttr "groupId99.id" "|group11|polySurface39|polySurfaceShape39.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface39|polySurfaceShape39.iog.og[0].gco"
		;
connectAttr "groupId35.id" "|group11|polySurface6|polySurfaceShape9.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface6|polySurfaceShape9.iog.og[0].gco"
		;
connectAttr "groupId64.id" "polySurfaceShape58.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape58.iog.og[0].gco";
connectAttr "groupId68.id" "polySurfaceShape59.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape59.iog.og[0].gco";
connectAttr "groupId84.id" "|group11|polySurface25|polySurfaceShape60.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface25|polySurfaceShape60.iog.og[0].gco"
		;
connectAttr "groupId76.id" "|group11|polySurface23|polySurfaceShape53.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface23|polySurfaceShape53.iog.og[0].gco"
		;
connectAttr "groupId101.id" "polySurfaceShape41.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape41.iog.og[0].gco";
connectAttr "groupId93.id" "polySurfaceShape33.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape33.iog.og[0].gco";
connectAttr "groupId94.id" "polySurfaceShape34.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape34.iog.og[0].gco";
connectAttr "groupId128.id" "polySurfaceShape73.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape73.iog.og[0].gco";
connectAttr "groupId129.id" "polySurfaceShape73.iog.og[3].gid";
connectAttr "blinn1SG.mwc" "polySurfaceShape73.iog.og[3].gco";
connectAttr "groupId112.id" "polySurfaceShape44.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape44.iog.og[0].gco";
connectAttr "groupId113.id" "polySurfaceShape44.iog.og[3].gid";
connectAttr "blinn1SG.mwc" "polySurfaceShape44.iog.og[3].gco";
connectAttr "groupId114.id" "polySurfaceShape45.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape45.iog.og[0].gco";
connectAttr "groupId115.id" "polySurfaceShape45.iog.og[3].gid";
connectAttr "blinn1SG.mwc" "polySurfaceShape45.iog.og[3].gco";
connectAttr "groupId130.id" "|group11|polySurface48|polySurfaceShape48.iog.og[0].gid"
		;
connectAttr ":initialShadingGroup.mwc" "|group11|polySurface48|polySurfaceShape48.iog.og[0].gco"
		;
connectAttr "groupId131.id" "|group11|polySurface48|polySurfaceShape48.iog.og[3].gid"
		;
connectAttr "blinn1SG.mwc" "|group11|polySurface48|polySurfaceShape48.iog.og[3].gco"
		;
connectAttr "groupId132.id" "polySurfaceShape79.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape79.iog.og[0].gco";
connectAttr "groupId133.id" "polySurfaceShape80.iog.og[0].gid";
connectAttr ":initialShadingGroup.mwc" "polySurfaceShape80.iog.og[0].gco";
connectAttr "groupId134.id" "polySurfaceShape80.iog.og[3].gid";
connectAttr "blinn1SG.mwc" "polySurfaceShape80.iog.og[3].gco";
relationship "link" ":lightLinker1" ":initialShadingGroup.message" ":defaultLightSet.message";
relationship "link" ":lightLinker1" ":initialParticleSE.message" ":defaultLightSet.message";
relationship "link" ":lightLinker1" "aiStandardSurface1SG.message" ":defaultLightSet.message";
relationship "link" ":lightLinker1" "blinn1SG.message" ":defaultLightSet.message";
relationship "shadowLink" ":lightLinker1" ":initialShadingGroup.message" ":defaultLightSet.message";
relationship "shadowLink" ":lightLinker1" ":initialParticleSE.message" ":defaultLightSet.message";
relationship "shadowLink" ":lightLinker1" "aiStandardSurface1SG.message" ":defaultLightSet.message";
relationship "shadowLink" ":lightLinker1" "blinn1SG.message" ":defaultLightSet.message";
connectAttr "layerManager.dli[0]" "defaultLayer.id";
connectAttr "renderLayerManager.rlmi[0]" "defaultRenderLayer.rlid";
connectAttr ":defaultArnoldDisplayDriver.msg" ":defaultArnoldRenderOptions.drivers"
		 -na;
connectAttr ":defaultArnoldFilter.msg" ":defaultArnoldRenderOptions.filt";
connectAttr ":defaultArnoldDriver.msg" ":defaultArnoldRenderOptions.drvr";
connectAttr "aiStandardSurface1SG.msg" "materialInfo1.sg";
connectAttr "M_Glass.oc" "blinn1SG.ss";
connectAttr "polySurfaceShape18.iog" "blinn1SG.dsm" -na;
connectAttr "|group11|polySurface54|polySurfaceShape54.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape56.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape21.iog" "blinn1SG.dsm" -na;
connectAttr "|group11|polySurface60|polySurfaceShape60.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape51.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape57.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape22.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape55.iog" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape44.iog.og[3]" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape45.iog.og[3]" "blinn1SG.dsm" -na;
connectAttr "polySurfaceShape73.iog.og[3]" "blinn1SG.dsm" -na;
connectAttr "|group11|polySurface48|polySurfaceShape48.iog.og[3]" "blinn1SG.dsm"
		 -na;
connectAttr "polySurfaceShape80.iog.og[3]" "blinn1SG.dsm" -na;
connectAttr "groupId113.msg" "blinn1SG.gn" -na;
connectAttr "groupId115.msg" "blinn1SG.gn" -na;
connectAttr "groupId129.msg" "blinn1SG.gn" -na;
connectAttr "groupId131.msg" "blinn1SG.gn" -na;
connectAttr "groupId134.msg" "blinn1SG.gn" -na;
connectAttr "blinn1SG.msg" "materialInfo2.sg";
connectAttr "M_Glass.msg" "materialInfo2.m";
connectAttr ":defaultColorMgtGlobals.cme" "file1.cme";
connectAttr ":defaultColorMgtGlobals.cfe" "file1.cmcf";
connectAttr ":defaultColorMgtGlobals.cfp" "file1.cmcp";
connectAttr ":defaultColorMgtGlobals.wsn" "file1.ws";
connectAttr "place2dTexture1.c" "file1.c";
connectAttr "place2dTexture1.tf" "file1.tf";
connectAttr "place2dTexture1.rf" "file1.rf";
connectAttr "place2dTexture1.mu" "file1.mu";
connectAttr "place2dTexture1.mv" "file1.mv";
connectAttr "place2dTexture1.s" "file1.s";
connectAttr "place2dTexture1.wu" "file1.wu";
connectAttr "place2dTexture1.wv" "file1.wv";
connectAttr "place2dTexture1.re" "file1.re";
connectAttr "place2dTexture1.of" "file1.of";
connectAttr "place2dTexture1.r" "file1.ro";
connectAttr "place2dTexture1.n" "file1.n";
connectAttr "place2dTexture1.vt1" "file1.vt1";
connectAttr "place2dTexture1.vt2" "file1.vt2";
connectAttr "place2dTexture1.vt3" "file1.vt3";
connectAttr "place2dTexture1.vc1" "file1.vc1";
connectAttr "place2dTexture1.o" "file1.uv";
connectAttr "place2dTexture1.ofs" "file1.fs";
connectAttr "layerManager.dli[1]" "Skybox.id";
connectAttr "aiStandardSurface1SG.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[0].dn"
		;
connectAttr "M_Glass.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[1].dn"
		;
connectAttr "file1.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[2].dn"
		;
connectAttr "place2dTexture1.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[3].dn"
		;
connectAttr "blinn1SG.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[4].dn"
		;
connectAttr "aiSkyDomeLightShape1.msg" "hyperShadePrimaryNodeEditorSavedTabsInfo.tgi[0].ni[5].dn"
		;
connectAttr "aiStandardSurface1SG.pa" ":renderPartition.st" -na;
connectAttr "blinn1SG.pa" ":renderPartition.st" -na;
connectAttr "M_Glass.msg" ":defaultShaderList1.s" -na;
connectAttr "place2dTexture1.msg" ":defaultRenderUtilityList1.u" -na;
connectAttr "defaultRenderLayer.msg" ":defaultRenderingList1.r" -na;
connectAttr "aiSkyDomeLightShape1.ltd" ":lightList1.l" -na;
connectAttr "directionalLightShape1.ltd" ":lightList1.l" -na;
connectAttr "pointLightShape1.ltd" ":lightList1.l" -na;
connectAttr "file1.msg" ":defaultTextureList1.tx" -na;
connectAttr "pPlaneShape1.iog" ":initialShadingGroup.dsm" -na;
connectAttr "pCube1_1M_Ref1Shape.iog" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface6|polySurfaceShape9.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape19.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface20|polySurfaceShape32.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape26.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface53|polySurfaceShape53.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape8.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape49.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape58.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape52.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface9|polySurfaceShape9.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "pCube1_1M_Ref2Shape.iog" ":initialShadingGroup.dsm" -na;
connectAttr "pCube1_1M_Ref4Shape.iog" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape50.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape59.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "pCube1_1M_Ref5Shape.iog" ":initialShadingGroup.dsm" -na;
connectAttr "pCube1_1M_Ref6Shape.iog" ":initialShadingGroup.dsm" -na;
connectAttr "pPlaneShape2.iog" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface23|polySurfaceShape53.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "|group11|polySurface25|polySurfaceShape60.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape27.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape61.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface28|polySurfaceShape28.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape29.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape30.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape31.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface32|polySurfaceShape32.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape33.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape34.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape35.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape36.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape37.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape38.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface39|polySurfaceShape39.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "|group11|polySurface40|polySurfaceShape40.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape41.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape44.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape45.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface24|polySurfaceShape54.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape3.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape73.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "|group11|polySurface48|polySurfaceShape48.iog.og[0]" ":initialShadingGroup.dsm"
		 -na;
connectAttr "polySurfaceShape79.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "polySurfaceShape80.iog.og[0]" ":initialShadingGroup.dsm" -na;
connectAttr "groupId35.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId36.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId56.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId57.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId61.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId62.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId63.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId64.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId65.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId66.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId67.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId68.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId76.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId84.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId86.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId87.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId88.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId89.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId90.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId91.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId92.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId93.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId94.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId95.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId96.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId97.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId98.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId99.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId100.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId101.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId112.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId114.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId126.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId127.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId128.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId130.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId132.msg" ":initialShadingGroup.gn" -na;
connectAttr "groupId133.msg" ":initialShadingGroup.gn" -na;
connectAttr "aiSkyDomeLight1.iog" ":defaultLightSet.dsm" -na;
connectAttr "directionalLight1.iog" ":defaultLightSet.dsm" -na;
connectAttr "pointLight1.iog" ":defaultLightSet.dsm" -na;
// End of C5_1_Planning.ma
