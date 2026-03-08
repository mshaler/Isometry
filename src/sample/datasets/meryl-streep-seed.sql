-- ============================================================================
-- MERYL STREEP CAREER GRAPH
-- Demo Dataset for Isometry LATCH × GRAPH Explorer
-- 
-- Node types: person, film, award
-- Edge types: APPEARED_IN, DIRECTED, CO_STARRED, NOMINATED_FOR, 
--             RECURRING_COLLABORATOR, PRECEDED_BY
--
-- Inflection moments are flagged on film nodes:
--   inflection = 1, inflection_reason = "..."
--
-- LATCH coordinates on film nodes:
--   T → release_year (time axis)
--   H → awards_count, rt_score, box_office_m (three hierarchy facets)
--   C → genre, era (category axis)
-- ============================================================================

-- ============================================================================
-- NODES: PERSONS
-- ============================================================================
-- Meryl herself is the gravity well. id prefix: p_

INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
-- The star
('p_meryl',      'person', 'Meryl Streep',        'cast',     '["lead","meryl"]',         10, 'Born June 22, 1949. 21 Oscar nominations. 3 wins. Greatest of her generation.'),

-- Directors (recurring collaborators starred)
('p_nichols',    'person', 'Mike Nichols',         'director', '["director","recurring"]',  9, 'Directed Silkwood (1983), Heartburn (1986), Postcards from the Edge (1990), Adaptation (2002). Died 2014.'),
('p_demme',      'person', 'Jonathan Demme',       'director', '["director","recurring"]',  8, 'Directed Silence of the Lambs universe; directed Ricki and the Flash (2015). Died 2017.'),
('p_pollack',    'person', 'Sydney Pollack',       'director', '["director"]',              8, 'Directed Out of Africa (1985). Oscar winner.'),
('p_pakula',     'person', 'Alan J. Pakula',       'director', '["director"]',              8, 'Directed Sophie''s Choice (1982). Master of paranoid thriller and prestige drama.'),
('p_benton',     'person', 'Robert Benton',        'director', '["director"]',              8, 'Directed Kramer vs. Kramer (1979). Oscar winner for both direction and screenplay.'),
('p_reiner',     'person', 'Rob Reiner',           'director', '["director"]',              7, 'Directed Heartburn (1986). Iconic American director.'),
('p_eastwood',   'person', 'Clint Eastwood',       'director', '["director"]',              8, 'Directed Bridges of Madison County (1995). Actor-director icon.'),
('p_frears',     'person', 'Stephen Frears',       'director', '["director"]',              7, 'Directed Florence Foster Jenkins (2016). British prestige cinema.'),
('p_frankel',    'person', 'David Frankel',        'director', '["director"]',              7, 'Directed The Devil Wears Prada (2006), Hope Springs (2012).'),
('p_lloyd_p',    'person', 'Phyllida Lloyd',       'director', '["director","recurring"]',  7, 'Directed Mamma Mia! (2008), The Iron Lady (2011). Two Streep collaborations.'),
('p_ephron',     'person', 'Nora Ephron',          'director', '["director"]',              7, 'Directed Heartburn (1986), Silkwood co-produced. Wrote Postcards from the Edge.'),
('p_spielberg',  'person', 'Steven Spielberg',     'director', '["director"]',              9, 'Directed The Post (2017). Hollywood titan.'),
('p_soderbergh', 'person', 'Steven Soderbergh',    'director', '["director","recurring"]',  8, 'Directed The Laundromat (2019), Let Them All Talk (2020). Recurring collaborator.'),
('p_gerwig',     'person', 'Greta Gerwig',         'director', '["director","new_wave"]',   8, 'Directed Little Women (2019). New generation auteur.'),
('p_anderson_w', 'person', 'Wes Anderson',         'director', '["director","indie"]',      8, 'Directed Fantastic Mr. Fox (2009). Distinctive indie voice.'),
('p_marshall_r', 'person', 'Rob Marshall',         'director', '["director","musical"]',    7, 'Directed Into the Woods (2014), Mary Poppins Returns (2018).'),
('p_mckayadam',  'person', 'Adam McKay',           'director', '["director","comedy"]',     7, 'Directed Don''t Look Up (2021). Political satire specialist.'),
('p_kaufman',    'person', 'Charlie Kaufman',      'director', '["director","writer"]',     8, 'Wrote/directed Adaptation (2002). Metacinematic genius.'),

-- Key co-stars (significant recurring or career-defining)
('p_deniro',     'person', 'Robert De Niro',       'cast',     '["costar","early_career"]', 8, 'Co-starred in The Deer Hunter (1978). Suggested Streep for the role.'),
('p_hoffman_d',  'person', 'Dustin Hoffman',       'cast',     '["costar","new_hollywood"]',8, 'Co-starred in Kramer vs. Kramer (1979). Notorious on-set tension became great cinema.'),
('p_irons',      'person', 'Jeremy Irons',         'cast',     '["costar"]',                7, 'Co-starred in The French Lieutenant''s Woman (1981).'),
('p_eastwood_a', 'person', 'Clint Eastwood',       'cast',     '["costar"]',                8, 'Co-starred in Bridges of Madison County (1995). Director and star.'),
('p_streep_c',   'person', 'Cher',                 'cast',     '["costar"]',                7, 'Co-starred in Silkwood (1983). Career-defining supporting role for Cher.'),
('p_hathaway',   'person', 'Anne Hathaway',        'cast',     '["costar","new_gen"]',      8, 'Co-starred in The Devil Wears Prada (2006). Career-making role for Hathaway.'),
('p_blanchett',  'person', 'Cate Blanchett',       'cast',     '["costar","peer"]',         9, 'Co-starred in The Aviator (2004), The Hours adjacent era. Peer and rival talent.'),
('p_hoffman_p',  'person', 'Philip Seymour Hoffman','cast',    '["costar"]',                8, 'Co-starred in Doubt (2008). Died 2014. Magnetic opposition in Doubt.'),
('p_streep_a',   'person', 'Amy Adams',            'cast',     '["costar","new_gen"]',      8, 'Co-starred in Doubt (2008), Julie & Julia (2009). Career-defining collaborations.'),
('p_kidman',     'person', 'Nicole Kidman',        'cast',     '["costar","peer"]',         8, 'The Hours (2002). Peer-level talent. Kidman: "Streep was the reason I pursued acting."'),
('p_moore_j',    'person', 'Julianne Moore',       'cast',     '["costar","peer"]',         8, 'The Hours (2002). Three great actresses in one film.'),
('p_dicaprio',   'person', 'Leonardo DiCaprio',    'cast',     '["costar"]',                8, 'Co-starred in Don''t Look Up (2021). Two generational titans.'),
('p_roberts',    'person', 'Julia Roberts',        'cast',     '["costar"]',                8, 'Co-starred in August: Osage County (2013). Two Oscar royalty faces off.'),
('p_fonda',      'person', 'Jane Fonda',           'cast',     '["costar","pioneer"]',      8, 'Co-starred in Julia (1977). First film. Fonda opened doors for Streep.'),
('p_walken',     'person', 'Christopher Walken',   'cast',     '["costar","early_career"]', 7, 'Co-starred in The Deer Hunter (1978). Oscar winner for the same film.');

-- ============================================================================
-- NODES: FILMS
-- ============================================================================
-- Properties: release_year, genre, era, rt_score, box_office_m, awards_count
-- inflection: 1/0, inflection_reason
-- All stored in content (JSON) and tags; LATCH hierarchy via priority (awards_count)

INSERT INTO nodes (id, node_type, name, folder, tags, priority, source, source_id, content) VALUES

-- ERA 1: NEW HOLLYWOOD ARRIVAL (1977–1979)
('f_julia',        'film', 'Julia',                          'film', '["drama","new_hollywood","era_1"]', 2,  'film','1977', '{"release_year":1977,"genre":"drama","era":"new_hollywood","rt_score":82,"box_office_m":12,"awards_count":0,"inflection":0,"director_id":"p_zinnemann","accent":"american","role":"Anne Marie"}'),
('f_deer_hunter',  'film', 'The Deer Hunter',                'film', '["drama","war","new_hollywood","era_1","oscar_nom"]', 8, 'film','1978', '{"release_year":1978,"genre":"war_drama","era":"new_hollywood","rt_score":93,"box_office_m":49,"awards_count":1,"inflection":1,"inflection_reason":"First Oscar nomination. De Niro introduces her to film. New Hollywood cluster opens.","director_id":"p_cimino","accent":"american","role":"Linda"}'),
('f_seduction',    'film', 'The Seduction of Joe Tynan',     'film', '["drama","new_hollywood","era_1"]', 2, 'film','1979', '{"release_year":1979,"genre":"political_drama","era":"new_hollywood","rt_score":70,"box_office_m":8,"awards_count":0,"inflection":0,"director_id":"p_schatzberg","accent":"southern","role":"Karen Traynor"}'),
('f_kramer',       'film', 'Kramer vs. Kramer',              'film', '["drama","new_hollywood","era_1","oscar_win"]', 10,'film','1979', '{"release_year":1979,"genre":"domestic_drama","era":"new_hollywood","rt_score":90,"box_office_m":173,"awards_count":5,"inflection":1,"inflection_reason":"First Oscar WIN (Supporting). Bridges TV→prestige film. Hoffman cluster opens. Career-defining breakout.","director_id":"p_benton","accent":"american","role":"Joanna Kramer"}'),

-- ERA 2: PRESTIGE PEAK (1981–1985)
('f_french_lt',    'film', 'The French Lieutenant''s Woman', 'film', '["drama","british","era_2"]', 5, 'film','1981', '{"release_year":1981,"genre":"period_drama","era":"prestige_peak","rt_score":81,"box_office_m":12,"awards_count":2,"inflection":0,"director_id":"p_reisz","accent":"victorian_english","role":"Sarah/Anna"}'),
('f_sophies',      'film', 'Sophie''s Choice',               'film', '["drama","literary","era_2","oscar_win"]', 10,'film','1982', '{"release_year":1982,"genre":"literary_drama","era":"prestige_peak","rt_score":80,"box_office_m":30,"awards_count":5,"inflection":1,"inflection_reason":"Second Oscar WIN (Actress). Pakula/literary cluster. Polish accent. Defines prestige dramatic range ceiling. Career-making role.","director_id":"p_pakula","accent":"polish","role":"Sophie Zawistowski"}'),
('f_silkwood',     'film', 'Silkwood',                       'film', '["drama","political","era_2","oscar_nom"]', 7,'film','1983', '{"release_year":1983,"genre":"political_drama","era":"prestige_peak","rt_score":90,"box_office_m":35,"awards_count":1,"inflection":1,"inflection_reason":"Nichols collaboration begins. Cher introduced to cluster. Political realism register opens.","director_id":"p_nichols","accent":"oklahoma","role":"Karen Silkwood"}'),
('f_falling_in',   'film', 'Falling in Love',                'film', '["romance","era_2"]', 2, 'film','1984', '{"release_year":1984,"genre":"romance","era":"prestige_peak","rt_score":47,"box_office_m":14,"awards_count":0,"inflection":0,"director_id":"p_grosbard","accent":"american","role":"Molly Gilmore"}'),
('f_plenty',       'film', 'Plenty',                         'film', '["drama","british","era_2"]', 4, 'film','1985', '{"release_year":1985,"genre":"political_drama","era":"prestige_peak","rt_score":75,"box_office_m":3,"awards_count":1,"inflection":0,"director_id":"p_schepisi","accent":"british","role":"Susan Traherne"}'),
('f_out_of_africa','film', 'Out of Africa',                  'film', '["drama","epic","era_2","oscar_nom"]', 9,'film','1985', '{"release_year":1985,"genre":"epic_romance","era":"prestige_peak","rt_score":61,"box_office_m":87,"awards_count":2,"inflection":1,"inflection_reason":"Pollack cluster opens. Epic prestige register. Danish accent. First major box office + awards combination.","director_id":"p_pollack","accent":"danish","role":"Karen Blixen"}'),

-- ERA 3: WILDERNESS AND REINVENTION (1986–1994)
('f_heartburn',    'film', 'Heartburn',                      'film', '["drama","comedy","era_3"]', 3, 'film','1986', '{"release_year":1986,"genre":"dramedy","era":"wilderness","rt_score":65,"box_office_m":25,"awards_count":0,"inflection":0,"director_id":"p_nichols","accent":"american","role":"Rachel Samstat"}'),
('f_ironweed',     'film', 'Ironweed',                       'film', '["drama","era_3","oscar_nom"]', 6, 'film','1987', '{"release_year":1987,"genre":"literary_drama","era":"wilderness","rt_score":74,"box_office_m":5,"awards_count":1,"inflection":0,"director_id":"p_babenco","accent":"american","role":"Helen Archer"}'),
('f_cry_dark',     'film', 'A Cry in the Dark',              'film', '["drama","true_crime","era_3","oscar_nom"]', 6,'film','1988', '{"release_year":1988,"genre":"true_crime","era":"wilderness","rt_score":87,"box_office_m":7,"awards_count":1,"inflection":0,"director_id":"p_schepisi","accent":"australian","role":"Lindy Chamberlain"}'),
('f_she_devil',    'film', 'She-Devil',                      'film', '["comedy","era_3"]', 2, 'film','1989', '{"release_year":1989,"genre":"dark_comedy","era":"wilderness","rt_score":31,"box_office_m":18,"awards_count":0,"inflection":0,"director_id":"p_seidelman","accent":"american","role":"Mary Fisher"}'),
('f_postcards',    'film', 'Postcards from the Edge',        'film', '["comedy","musical","era_3","oscar_nom"]', 6,'film','1990', '{"release_year":1990,"genre":"musical_comedy","era":"wilderness","rt_score":77,"box_office_m":39,"awards_count":1,"inflection":1,"inflection_reason":"Nichols again. Comedy/musical register fully opens. Carrie Fisher screenplay. Singing debut.","director_id":"p_nichols","accent":"american","role":"Suzanne Vale"}'),
('f_defending',    'film', 'Defending Your Life',            'film', '["comedy","era_3"]', 3, 'film','1991', '{"release_year":1991,"genre":"fantasy_comedy","era":"wilderness","rt_score":89,"box_office_m":16,"awards_count":0,"inflection":0,"director_id":"p_brooks","accent":"american","role":"Julia"}'),
('f_death_becomes','film', 'Death Becomes Her',              'film', '["comedy","era_3"]', 4, 'film','1992', '{"release_year":1992,"genre":"dark_comedy","era":"wilderness","rt_score":57,"box_office_m":59,"awards_count":1,"inflection":0,"director_id":"p_zemeckis","accent":"american","role":"Madeline Ashton"}'),
('f_house_spirits','film', 'The House of the Spirits',       'film', '["drama","era_3"]', 3, 'film','1993', '{"release_year":1993,"genre":"magical_realism","era":"wilderness","rt_score":38,"box_office_m":6,"awards_count":0,"inflection":0,"director_id":"p_august","accent":"spanish","role":"Clara del Valle"}'),
('f_marvins_room', 'film', 'Marvin''s Room',                 'film', '["drama","era_3"]', 4, 'film','1996', '{"release_year":1996,"genre":"family_drama","era":"wilderness","rt_score":76,"box_office_m":12,"awards_count":0,"inflection":0,"director_id":"p_zaks","accent":"american","role":"Lee"}'),

-- ERA 4: LATE CAREER RENAISSANCE (1995–2005)
('f_bridges',      'film', 'The Bridges of Madison County',  'film', '["romance","era_4","oscar_nom"]', 8,'film','1995', '{"release_year":1995,"genre":"romance","era":"renaissance","rt_score":88,"box_office_m":182,"awards_count":1,"inflection":1,"inflection_reason":"Eastwood cluster opens. Late-career romantic register. Biggest 1990s hit. Silences decade of commercial struggles.","director_id":"p_eastwood","accent":"italian_american","role":"Francesca Johnson"}'),
('f_before_after',  'film', 'Before and After',             'film', '["drama","era_4"]', 2, 'film','1996', '{"release_year":1996,"genre":"thriller","era":"renaissance","rt_score":37,"box_office_m":10,"awards_count":0,"inflection":0,"director_id":"p_schroeder","accent":"american","role":"Carolyn Ryan"}'),
('f_first_do',     'film', 'First Do No Harm',              'film', '["drama","tv","era_4"]', 3, 'film','1997', '{"release_year":1997,"genre":"medical_drama","era":"renaissance","rt_score":null,"box_office_m":null,"awards_count":0,"inflection":0,"director_id":"p_duffell","accent":"american","role":"Lori Reimuller"}'),
('f_dancing_luigi','film', 'Dancing at Lughnasa',           'film', '["drama","irish","era_4"]', 4, 'film','1998', '{"release_year":1998,"genre":"period_drama","era":"renaissance","rt_score":60,"box_office_m":3,"awards_count":0,"inflection":0,"director_id":"p_saville","accent":"irish","role":"Kate Mundy"}'),
('f_one_true',     'film', 'One True Thing',                'film', '["drama","era_4","oscar_nom"]', 6,'film','1998', '{"release_year":1998,"genre":"family_drama","era":"renaissance","rt_score":74,"box_office_m":14,"awards_count":1,"inflection":0,"director_id":"p_franklin","accent":"american","role":"Kate Gulden"}'),
('f_music_heart',  'film', 'Music of the Heart',            'film', '["drama","true_story","era_4","oscar_nom"]', 6,'film','1999', '{"release_year":1999,"genre":"inspirational_drama","era":"renaissance","rt_score":63,"box_office_m":14,"awards_count":1,"inflection":0,"director_id":"p_craven","accent":"new_york","role":"Roberta Guaspari"}'),
('f_hours',        'film', 'The Hours',                     'film', '["drama","literary","era_4","oscar_nom"]', 9,'film','2002', '{"release_year":2002,"genre":"literary_drama","era":"renaissance","rt_score":80,"box_office_m":42,"awards_count":3,"inflection":1,"inflection_reason":"Kidman + Moore cluster. Three-actress ensemble. Berlin Silver Bear. Bridges indie prestige with mainstream awards.","director_id":"p_daldry","accent":"american","role":"Clarissa Vaughan"}'),
('f_adaptation',   'film', 'Adaptation',                   'film', '["comedy","meta","era_4","oscar_nom"]', 8,'film','2002', '{"release_year":2002,"genre":"meta_comedy","era":"renaissance","rt_score":91,"box_office_m":22,"awards_count":1,"inflection":1,"inflection_reason":"Kaufman/Nichols cluster. Comedy nominated for drama awards. Range signal: same year as The Hours, opposite genre.","director_id":"p_jonze","accent":"american","role":"Susan Orlean"}'),

-- ERA 5: SECOND GOLDEN AGE (2006–2012)
('f_prada',        'film', 'The Devil Wears Prada',         'film', '["comedy","fashion","era_5","oscar_nom"]', 9,'film','2006', '{"release_year":2006,"genre":"dark_comedy","era":"golden_age_2","rt_score":75,"box_office_m":327,"awards_count":2,"inflection":1,"inflection_reason":"Comedy/camp register fully weaponized. Hathaway cluster opens. Gen-Y audience captured. $327M global. Career renaissance peak.","director_id":"p_frankel","accent":"american","role":"Miranda Priestly"}'),
('f_rendition',    'film', 'Rendition',                     'film', '["thriller","era_5"]', 3, 'film','2007', '{"release_year":2007,"genre":"political_thriller","era":"golden_age_2","rt_score":46,"box_office_m":10,"awards_count":0,"inflection":0,"director_id":"p_hood","accent":"american","role":"Corinne Whitman"}'),
('f_lions_lambs',  'film', 'Lions for Lambs',               'film', '["drama","political","era_5"]', 3, 'film','2007', '{"release_year":2007,"genre":"political_drama","era":"golden_age_2","rt_score":27,"box_office_m":15,"awards_count":0,"inflection":0,"director_id":"p_redford","accent":"american","role":"Janine Roth"}'),
('f_mamma_mia',    'film', 'Mamma Mia!',                    'film', '["musical","comedy","era_5"]', 8, 'film','2008', '{"release_year":2008,"genre":"musical_comedy","era":"golden_age_2","rt_score":54,"box_office_m":609,"awards_count":0,"inflection":1,"inflection_reason":"Biggest box office of career ($609M). Musical cluster fully operational. Lloyd collaboration deepens. Global phenomenon.","director_id":"p_lloyd_p","accent":"american","role":"Donna Sheridan"}'),
('f_doubt',        'film', 'Doubt',                         'film', '["drama","era_5","oscar_nom"]', 8,'film','2008', '{"release_year":2008,"genre":"chamber_drama","era":"golden_age_2","rt_score":79,"box_office_m":33,"awards_count":1,"inflection":0,"director_id":"p_shanley","accent":"bronx","role":"Sister Aloysius Beauvier"}'),
('f_julie_julia',  'film', 'Julie & Julia',                 'film', '["comedy","biopic","era_5","oscar_nom"]', 8,'film','2009', '{"release_year":2009,"genre":"biopic_comedy","era":"golden_age_2","rt_score":76,"box_office_m":129,"awards_count":2,"inflection":0,"director_id":"p_ephron_n","accent":"julia_child","role":"Julia Child"}'),
('f_fox',          'film', 'Fantastic Mr. Fox',             'film', '["animated","comedy","era_5"]', 5, 'film','2009', '{"release_year":2009,"genre":"animated_comedy","era":"golden_age_2","rt_score":93,"box_office_m":46,"awards_count":0,"inflection":1,"inflection_reason":"Anderson cluster opens. Voice acting. Animated register. Broadens to indie animation audience.","director_id":"p_anderson_w","accent":"american_voice","role":"Mrs. Fox (voice)"}'),
('f_complicated',  'film', 'It''s Complicated',             'film', '["comedy","era_5"]', 5, 'film','2009', '{"release_year":2009,"genre":"romantic_comedy","era":"golden_age_2","rt_score":56,"box_office_m":224,"awards_count":0,"inflection":0,"director_id":"p_meyers","accent":"american","role":"Jane"}'),
('f_iron_lady',    'film', 'The Iron Lady',                 'film', '["biopic","era_5","oscar_win"]', 10,'film','2011', '{"release_year":2011,"genre":"political_biopic","era":"golden_age_2","rt_score":53,"box_office_m":114,"awards_count":5,"inflection":1,"inflection_reason":"Third Oscar WIN. Lloyd collaboration delivers. Transformation performance cluster complete. British political register.","director_id":"p_lloyd_p","accent":"thatcher_english","role":"Margaret Thatcher"}'),
('f_hope_springs', 'film', 'Hope Springs',                  'film', '["drama","comedy","era_5"]', 4, 'film','2012', '{"release_year":2012,"genre":"dramedy","era":"golden_age_2","rt_score":76,"box_office_m":68,"awards_count":0,"inflection":0,"director_id":"p_frankel","accent":"american","role":"Kay Soames"}'),

-- ERA 6: ELDER STATESWOMAN (2013–2023)
('f_osage',        'film', 'August: Osage County',          'film', '["drama","era_6","oscar_nom"]', 8,'film','2013', '{"release_year":2013,"genre":"family_drama","era":"elder","rt_score":64,"box_office_m":59,"awards_count":1,"inflection":0,"director_id":"p_wells","accent":"oklahoma","role":"Violet Weston"}'),
('f_giver',        'film', 'The Giver',                     'film', '["scifi","era_6"]', 3, 'film','2014', '{"release_year":2014,"genre":"dystopian_scifi","era":"elder","rt_score":35,"box_office_m":67,"awards_count":0,"inflection":0,"director_id":"p_noyce","accent":"american","role":"Chief Elder"}'),
('f_into_woods',   'film', 'Into the Woods',                'film', '["musical","era_6","oscar_nom"]', 7,'film','2014', '{"release_year":2014,"genre":"musical_fantasy","era":"elder","rt_score":71,"box_office_m":213,"awards_count":1,"inflection":0,"director_id":"p_marshall_r","accent":"american","role":"The Witch"}'),
('f_ricki',        'film', 'Ricki and the Flash',           'film', '["drama","musical","era_6"]', 4, 'film','2015', '{"release_year":2015,"genre":"musical_drama","era":"elder","rt_score":65,"box_office_m":15,"awards_count":0,"inflection":0,"director_id":"p_demme","accent":"american","role":"Ricki Rendazzo"}'),
('f_suffragette',  'film', 'Suffragette',                   'film', '["historical","era_6"]', 4, 'film','2015', '{"release_year":2015,"genre":"historical_drama","era":"elder","rt_score":72,"box_office_m":25,"awards_count":0,"inflection":0,"director_id":"p_gavron","accent":"british","role":"Emmeline Pankhurst"}'),
('f_florence',     'film', 'Florence Foster Jenkins',       'film', '["biopic","comedy","era_6","oscar_nom"]', 8,'film','2016', '{"release_year":2016,"genre":"biopic_comedy","era":"elder","rt_score":87,"box_office_m":40,"awards_count":1,"inflection":0,"director_id":"p_frears","accent":"new_york_posh","role":"Florence Foster Jenkins"}'),
('f_the_post',     'film', 'The Post',                      'film', '["historical","thriller","era_6","oscar_nom"]', 8,'film','2017', '{"release_year":2017,"genre":"historical_thriller","era":"elder","rt_score":88,"box_office_m":179,"awards_count":1,"inflection":1,"inflection_reason":"Spielberg cluster opens. Pentagon Papers. First female-led Spielberg. Historical journalism register. 21st nomination.","director_id":"p_spielberg","accent":"american","role":"Katharine Graham"}'),
('f_mamma_mia2',   'film', 'Mamma Mia! Here We Go Again',  'film', '["musical","era_6"]', 4, 'film','2018', '{"release_year":2018,"genre":"musical_comedy","era":"elder","rt_score":79,"box_office_m":395,"awards_count":0,"inflection":0,"director_id":"p_parker","accent":"american","role":"Ruby Sheridan"}'),
('f_poppins',      'film', 'Mary Poppins Returns',          'film', '["musical","era_6"]', 3, 'film','2018', '{"release_year":2018,"genre":"family_musical","era":"elder","rt_score":80,"box_office_m":172,"awards_count":0,"inflection":0,"director_id":"p_marshall_r","accent":"cockney_adjacent","role":"Topsy"}'),
('f_laundromat',   'film', 'The Laundromat',                'film', '["comedy","era_6"]', 4, 'film','2019', '{"release_year":2019,"genre":"political_comedy","era":"elder","rt_score":48,"box_office_m":null,"awards_count":0,"inflection":0,"director_id":"p_soderbergh","accent":"american","role":"Ellen Martin"}'),
('f_little_women', 'film', 'Little Women',                  'film', '["drama","literary","era_6"]', 6, 'film','2019', '{"release_year":2019,"genre":"period_drama","era":"elder","rt_score":95,"box_office_m":218,"awards_count":0,"inflection":1,"inflection_reason":"Gerwig new-wave cluster opens. Bridges to next generation of directors. 95% RT.","director_id":"p_gerwig","accent":"american","role":"Aunt March"}'),
('f_dont_look_up', 'film', 'Don''t Look Up',                'film', '["comedy","satire","era_6"]', 7, 'film','2021', '{"release_year":2021,"genre":"political_satire","era":"elder","rt_score":56,"box_office_m":null,"awards_count":0,"inflection":0,"director_id":"p_mckayadam","accent":"american","role":"President Orlean"}');

-- ============================================================================
-- NODES: AWARDS (First-class nodes, not just properties)
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
('a_oscar_78',  'award', 'Oscar: Best Supporting Actress 1979',   'award', '["oscar","nominated"]',   7, '{"year":1979,"ceremony":51,"category":"Best Supporting Actress","result":"nominated","film_id":"f_deer_hunter"}'),
('a_oscar_80',  'award', 'Oscar: Best Supporting Actress 1980',   'award', '["oscar","win"]',         10,'{"year":1980,"ceremony":52,"category":"Best Supporting Actress","result":"WIN","film_id":"f_kramer"}'),
('a_oscar_83',  'award', 'Oscar: Best Actress 1983',              'award', '["oscar","win"]',         10,'{"year":1983,"ceremony":55,"category":"Best Actress","result":"WIN","film_id":"f_sophies"}'),
('a_oscar_84',  'award', 'Oscar: Best Actress 1984',              'award', '["oscar","nominated"]',   7, '{"year":1984,"ceremony":56,"category":"Best Actress","result":"nominated","film_id":"f_silkwood"}'),
('a_oscar_86',  'award', 'Oscar: Best Actress 1986',              'award', '["oscar","nominated"]',   7, '{"year":1986,"ceremony":58,"category":"Best Actress","result":"nominated","film_id":"f_out_of_africa"}'),
('a_oscar_88',  'award', 'Oscar: Best Actress 1988',              'award', '["oscar","nominated"]',   7, '{"year":1988,"ceremony":60,"category":"Best Actress","result":"nominated","film_id":"f_ironweed"}'),
('a_oscar_89',  'award', 'Oscar: Best Actress 1989',              'award', '["oscar","nominated"]',   7, '{"year":1989,"ceremony":61,"category":"Best Actress","result":"nominated","film_id":"f_cry_dark"}'),
('a_oscar_91',  'award', 'Oscar: Best Actress 1991',              'award', '["oscar","nominated"]',   7, '{"year":1991,"ceremony":63,"category":"Best Actress","result":"nominated","film_id":"f_postcards"}'),
('a_oscar_96',  'award', 'Oscar: Best Actress 1996',              'award', '["oscar","nominated"]',   7, '{"year":1996,"ceremony":68,"category":"Best Actress","result":"nominated","film_id":"f_bridges"}'),
('a_oscar_99',  'award', 'Oscar: Best Actress 1999',              'award', '["oscar","nominated"]',   7, '{"year":1999,"ceremony":71,"category":"Best Actress","result":"nominated","film_id":"f_one_true"}'),
('a_oscar_00',  'award', 'Oscar: Best Actress 2000',              'award', '["oscar","nominated"]',   7, '{"year":2000,"ceremony":72,"category":"Best Actress","result":"nominated","film_id":"f_music_heart"}'),
('a_oscar_03a', 'award', 'Oscar: Best Actress 2003 (The Hours)',  'award', '["oscar","nominated"]',   7, '{"year":2003,"ceremony":75,"category":"Best Actress","result":"nominated","film_id":"f_hours"}'),
('a_oscar_03b', 'award', 'Oscar: Best Supporting Actress 2003',  'award', '["oscar","nominated"]',   7, '{"year":2003,"ceremony":75,"category":"Best Supporting Actress","result":"nominated","film_id":"f_adaptation"}'),
('a_oscar_07',  'award', 'Oscar: Best Actress 2007',              'award', '["oscar","nominated"]',   7, '{"year":2007,"ceremony":79,"category":"Best Actress","result":"nominated","film_id":"f_prada"}'),
('a_oscar_09',  'award', 'Oscar: Best Actress 2009',              'award', '["oscar","nominated"]',   7, '{"year":2009,"ceremony":81,"category":"Best Actress","result":"nominated","film_id":"f_doubt"}'),
('a_oscar_10',  'award', 'Oscar: Best Actress 2010',              'award', '["oscar","nominated"]',   7, '{"year":2010,"ceremony":82,"category":"Best Actress","result":"nominated","film_id":"f_julie_julia"}'),
('a_oscar_12',  'award', 'Oscar: Best Actress 2012',              'award', '["oscar","win"]',         10,'{"year":2012,"ceremony":84,"category":"Best Actress","result":"WIN","film_id":"f_iron_lady"}'),
('a_oscar_14',  'award', 'Oscar: Best Actress 2014',              'award', '["oscar","nominated"]',   7, '{"year":2014,"ceremony":86,"category":"Best Actress","result":"nominated","film_id":"f_osage"}'),
('a_oscar_15',  'award', 'Oscar: Best Supporting Actress 2015',  'award', '["oscar","nominated"]',   7, '{"year":2015,"ceremony":87,"category":"Best Supporting Actress","result":"nominated","film_id":"f_into_woods"}'),
('a_oscar_17',  'award', 'Oscar: Best Actress 2017',              'award', '["oscar","nominated"]',   7, '{"year":2017,"ceremony":89,"category":"Best Actress","result":"nominated","film_id":"f_florence"}'),
('a_oscar_18',  'award', 'Oscar: Best Actress 2018',              'award', '["oscar","nominated"]',   7, '{"year":2018,"ceremony":90,"category":"Best Actress","result":"nominated","film_id":"f_the_post"}');

-- ============================================================================
-- EDGES: APPEARED_IN (Meryl → Film)
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
('e_ap_julia',        'LINK', 'p_meryl', 'f_julia',         0.4, 'APPEARED_IN', 1),
('e_ap_deer',         'LINK', 'p_meryl', 'f_deer_hunter',   0.8, 'APPEARED_IN', 1),
('e_ap_seduction',    'LINK', 'p_meryl', 'f_seduction',     0.5, 'APPEARED_IN', 1),
('e_ap_kramer',       'LINK', 'p_meryl', 'f_kramer',        1.0, 'APPEARED_IN', 1),
('e_ap_french',       'LINK', 'p_meryl', 'f_french_lt',     0.7, 'APPEARED_IN', 1),
('e_ap_sophies',      'LINK', 'p_meryl', 'f_sophies',       1.0, 'APPEARED_IN', 1),
('e_ap_silkwood',     'LINK', 'p_meryl', 'f_silkwood',      0.9, 'APPEARED_IN', 1),
('e_ap_falling',      'LINK', 'p_meryl', 'f_falling_in',    0.4, 'APPEARED_IN', 1),
('e_ap_plenty',       'LINK', 'p_meryl', 'f_plenty',        0.6, 'APPEARED_IN', 1),
('e_ap_africa',       'LINK', 'p_meryl', 'f_out_of_africa', 0.9, 'APPEARED_IN', 1),
('e_ap_heartburn',    'LINK', 'p_meryl', 'f_heartburn',     0.5, 'APPEARED_IN', 1),
('e_ap_ironweed',     'LINK', 'p_meryl', 'f_ironweed',      0.7, 'APPEARED_IN', 1),
('e_ap_cry',          'LINK', 'p_meryl', 'f_cry_dark',      0.7, 'APPEARED_IN', 1),
('e_ap_shedevil',     'LINK', 'p_meryl', 'f_she_devil',     0.3, 'APPEARED_IN', 1),
('e_ap_postcards',    'LINK', 'p_meryl', 'f_postcards',     0.7, 'APPEARED_IN', 1),
('e_ap_defending',    'LINK', 'p_meryl', 'f_defending',     0.5, 'APPEARED_IN', 1),
('e_ap_death',        'LINK', 'p_meryl', 'f_death_becomes', 0.4, 'APPEARED_IN', 1),
('e_ap_spirits',      'LINK', 'p_meryl', 'f_house_spirits', 0.4, 'APPEARED_IN', 1),
('e_ap_marvins',      'LINK', 'p_meryl', 'f_marvins_room',  0.5, 'APPEARED_IN', 1),
('e_ap_bridges',      'LINK', 'p_meryl', 'f_bridges',       0.9, 'APPEARED_IN', 1),
('e_ap_before',       'LINK', 'p_meryl', 'f_before_after',  0.3, 'APPEARED_IN', 1),
('e_ap_dancing',      'LINK', 'p_meryl', 'f_dancing_luigi', 0.5, 'APPEARED_IN', 1),
('e_ap_onetrue',      'LINK', 'p_meryl', 'f_one_true',      0.6, 'APPEARED_IN', 1),
('e_ap_music',        'LINK', 'p_meryl', 'f_music_heart',   0.6, 'APPEARED_IN', 1),
('e_ap_hours',        'LINK', 'p_meryl', 'f_hours',         0.9, 'APPEARED_IN', 1),
('e_ap_adaptation',   'LINK', 'p_meryl', 'f_adaptation',    0.8, 'APPEARED_IN', 1),
('e_ap_prada',        'LINK', 'p_meryl', 'f_prada',         1.0, 'APPEARED_IN', 1),
('e_ap_rendition',    'LINK', 'p_meryl', 'f_rendition',     0.3, 'APPEARED_IN', 1),
('e_ap_lions',        'LINK', 'p_meryl', 'f_lions_lambs',   0.3, 'APPEARED_IN', 1),
('e_ap_mammamia',     'LINK', 'p_meryl', 'f_mamma_mia',     0.8, 'APPEARED_IN', 1),
('e_ap_doubt',        'LINK', 'p_meryl', 'f_doubt',         0.8, 'APPEARED_IN', 1),
('e_ap_juliejulia',   'LINK', 'p_meryl', 'f_julie_julia',   0.8, 'APPEARED_IN', 1),
('e_ap_fox',          'LINK', 'p_meryl', 'f_fox',           0.6, 'APPEARED_IN', 1),
('e_ap_complicated',  'LINK', 'p_meryl', 'f_complicated',   0.5, 'APPEARED_IN', 1),
('e_ap_ironlady',     'LINK', 'p_meryl', 'f_iron_lady',     1.0, 'APPEARED_IN', 1),
('e_ap_hopespr',      'LINK', 'p_meryl', 'f_hope_springs',  0.5, 'APPEARED_IN', 1),
('e_ap_osage',        'LINK', 'p_meryl', 'f_osage',         0.8, 'APPEARED_IN', 1),
('e_ap_giver',        'LINK', 'p_meryl', 'f_giver',         0.3, 'APPEARED_IN', 1),
('e_ap_intowoods',    'LINK', 'p_meryl', 'f_into_woods',    0.7, 'APPEARED_IN', 1),
('e_ap_ricki',        'LINK', 'p_meryl', 'f_ricki',         0.6, 'APPEARED_IN', 1),
('e_ap_suffragette',  'LINK', 'p_meryl', 'f_suffragette',   0.5, 'APPEARED_IN', 1),
('e_ap_florence',     'LINK', 'p_meryl', 'f_florence',      0.8, 'APPEARED_IN', 1),
('e_ap_post',         'LINK', 'p_meryl', 'f_the_post',      0.9, 'APPEARED_IN', 1),
('e_ap_mamma2',       'LINK', 'p_meryl', 'f_mamma_mia2',    0.5, 'APPEARED_IN', 1),
('e_ap_poppins',      'LINK', 'p_meryl', 'f_poppins',       0.4, 'APPEARED_IN', 1),
('e_ap_laundromat',   'LINK', 'p_meryl', 'f_laundromat',    0.4, 'APPEARED_IN', 1),
('e_ap_littlewomen',  'LINK', 'p_meryl', 'f_little_women',  0.6, 'APPEARED_IN', 1),
('e_ap_dontlookup',   'LINK', 'p_meryl', 'f_dont_look_up',  0.6, 'APPEARED_IN', 1);

-- ============================================================================
-- EDGES: DIRECTED (Director → Film)
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
('e_dir_benton_kramer',    'LINK', 'p_benton',     'f_kramer',        0.9, 'DIRECTED', 1),
('e_dir_pakula_sophies',   'LINK', 'p_pakula',     'f_sophies',       1.0, 'DIRECTED', 1),
('e_dir_nichols_silk',     'LINK', 'p_nichols',    'f_silkwood',      0.9, 'DIRECTED', 1),
('e_dir_pollack_africa',   'LINK', 'p_pollack',    'f_out_of_africa', 0.9, 'DIRECTED', 1),
('e_dir_nichols_heartburn','LINK', 'p_nichols',    'f_heartburn',     0.7, 'DIRECTED', 1),
('e_dir_nichols_postcards','LINK', 'p_nichols',    'f_postcards',     0.8, 'DIRECTED', 1),
('e_dir_eastwood_bridges', 'LINK', 'p_eastwood',   'f_bridges',       0.9, 'DIRECTED', 1),
('e_dir_daldry_hours',     'LINK', 'p_daldry',     'f_hours',         0.8, 'DIRECTED', 1),
('e_dir_nichols_adapt',    'LINK', 'p_nichols',    'f_adaptation',    0.8, 'DIRECTED', 1),
('e_dir_frankel_prada',    'LINK', 'p_frankel',    'f_prada',         0.9, 'DIRECTED', 1),
('e_dir_lloyd_mammamia',   'LINK', 'p_lloyd_p',    'f_mamma_mia',     0.8, 'DIRECTED', 1),
('e_dir_lloyd_ironlady',   'LINK', 'p_lloyd_p',    'f_iron_lady',     1.0, 'DIRECTED', 1),
('e_dir_frankel_hope',     'LINK', 'p_frankel',    'f_hope_springs',  0.7, 'DIRECTED', 1),
('e_dir_spielberg_post',   'LINK', 'p_spielberg',  'f_the_post',      0.9, 'DIRECTED', 1),
('e_dir_soderbergh_laund', 'LINK', 'p_soderbergh', 'f_laundromat',    0.7, 'DIRECTED', 1),
('e_dir_soderbergh_talk',  'LINK', 'p_soderbergh', 'f_dont_look_up',  0.5, 'DIRECTED', 1),
('e_dir_gerwig_women',     'LINK', 'p_gerwig',     'f_little_women',  0.9, 'DIRECTED', 1),
('e_dir_anderson_fox',     'LINK', 'p_anderson_w', 'f_fox',           0.8, 'DIRECTED', 1),
('e_dir_marshall_woods',   'LINK', 'p_marshall_r', 'f_into_woods',    0.7, 'DIRECTED', 1),
('e_dir_frears_florence',  'LINK', 'p_frears',     'f_florence',      0.8, 'DIRECTED', 1),
('e_dir_demme_ricki',      'LINK', 'p_demme',      'f_ricki',         0.7, 'DIRECTED', 1),
('e_dir_mckay_lookup',     'LINK', 'p_mckayadam',  'f_dont_look_up',  0.7, 'DIRECTED', 1);

-- ============================================================================
-- EDGES: CO_STARRED (Co-star → Film)
-- Key collaborators only — the graph would get noisy with every extra
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
('e_co_fonda_julia',       'LINK', 'p_fonda',      'f_julia',         0.8, 'CO_STARRED', 1),
('e_co_deniro_deer',       'LINK', 'p_deniro',     'f_deer_hunter',   0.9, 'CO_STARRED', 1),
('e_co_walken_deer',       'LINK', 'p_walken',     'f_deer_hunter',   0.7, 'CO_STARRED', 1),
('e_co_hoffman_kramer',    'LINK', 'p_hoffman_d',  'f_kramer',        1.0, 'CO_STARRED', 1),
('e_co_irons_french',      'LINK', 'p_irons',      'f_french_lt',     0.8, 'CO_STARRED', 1),
('e_co_cher_silkwood',     'LINK', 'p_streep_c',   'f_silkwood',      0.8, 'CO_STARRED', 1),
('e_co_eastwood_bridges',  'LINK', 'p_eastwood_a', 'f_bridges',       0.9, 'CO_STARRED', 1),
('e_co_kidman_hours',      'LINK', 'p_kidman',     'f_hours',         0.9, 'CO_STARRED', 1),
('e_co_moore_hours',       'LINK', 'p_moore_j',    'f_hours',         0.9, 'CO_STARRED', 1),
('e_co_hathaway_prada',    'LINK', 'p_hathaway',   'f_prada',         0.9, 'CO_STARRED', 1),
('e_co_phoffman_doubt',    'LINK', 'p_hoffman_p',  'f_doubt',         0.9, 'CO_STARRED', 1),
('e_co_adams_doubt',       'LINK', 'p_streep_a',   'f_doubt',         0.8, 'CO_STARRED', 1),
('e_co_adams_julia',       'LINK', 'p_streep_a',   'f_julie_julia',   0.8, 'CO_STARRED', 1),
('e_co_roberts_osage',     'LINK', 'p_roberts',    'f_osage',         0.9, 'CO_STARRED', 1),
('e_co_dicaprio_lookup',   'LINK', 'p_dicaprio',   'f_dont_look_up',  0.8, 'CO_STARRED', 1);

-- ============================================================================
-- EDGES: NOMINATED_FOR (Film → Award)
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
('e_nom_deer',      'LINK', 'f_deer_hunter',  'a_oscar_78',  0.7, 'NOMINATED_FOR', 1),
('e_nom_kramer',    'LINK', 'f_kramer',        'a_oscar_80',  1.0, 'NOMINATED_FOR', 1),
('e_nom_sophies',   'LINK', 'f_sophies',       'a_oscar_83',  1.0, 'NOMINATED_FOR', 1),
('e_nom_silkwood',  'LINK', 'f_silkwood',      'a_oscar_84',  0.7, 'NOMINATED_FOR', 1),
('e_nom_africa',    'LINK', 'f_out_of_africa', 'a_oscar_86',  0.7, 'NOMINATED_FOR', 1),
('e_nom_ironweed',  'LINK', 'f_ironweed',      'a_oscar_88',  0.7, 'NOMINATED_FOR', 1),
('e_nom_cry',       'LINK', 'f_cry_dark',      'a_oscar_89',  0.7, 'NOMINATED_FOR', 1),
('e_nom_postcards', 'LINK', 'f_postcards',     'a_oscar_91',  0.7, 'NOMINATED_FOR', 1),
('e_nom_bridges',   'LINK', 'f_bridges',       'a_oscar_96',  0.7, 'NOMINATED_FOR', 1),
('e_nom_onetrue',   'LINK', 'f_one_true',      'a_oscar_99',  0.7, 'NOMINATED_FOR', 1),
('e_nom_music',     'LINK', 'f_music_heart',   'a_oscar_00',  0.7, 'NOMINATED_FOR', 1),
('e_nom_hours',     'LINK', 'f_hours',         'a_oscar_03a', 0.7, 'NOMINATED_FOR', 1),
('e_nom_adaptation','LINK', 'f_adaptation',    'a_oscar_03b', 0.7, 'NOMINATED_FOR', 1),
('e_nom_prada',     'LINK', 'f_prada',         'a_oscar_07',  0.7, 'NOMINATED_FOR', 1),
('e_nom_doubt',     'LINK', 'f_doubt',         'a_oscar_09',  0.7, 'NOMINATED_FOR', 1),
('e_nom_julia',     'LINK', 'f_julie_julia',   'a_oscar_10',  0.7, 'NOMINATED_FOR', 1),
('e_nom_ironlady',  'LINK', 'f_iron_lady',     'a_oscar_12',  1.0, 'NOMINATED_FOR', 1),
('e_nom_osage',     'LINK', 'f_osage',         'a_oscar_14',  0.7, 'NOMINATED_FOR', 1),
('e_nom_woods',     'LINK', 'f_into_woods',    'a_oscar_15',  0.7, 'NOMINATED_FOR', 1),
('e_nom_florence',  'LINK', 'f_florence',      'a_oscar_17',  0.7, 'NOMINATED_FOR', 1),
('e_nom_post',      'LINK', 'f_the_post',      'a_oscar_18',  0.7, 'NOMINATED_FOR', 1);

-- ============================================================================
-- EDGES: RECURRING_COLLABORATOR (person → person, derived, undirected)
-- Threshold: 2+ films together
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
-- Nichols: Silkwood, Heartburn, Postcards, Adaptation = 4 films
('e_rec_nichols',   'AFFINITY', 'p_meryl', 'p_nichols',    1.0, 'RECURRING_COLLABORATOR', 0),
-- Lloyd: Mamma Mia, Iron Lady = 2 films
('e_rec_lloyd',     'AFFINITY', 'p_meryl', 'p_lloyd_p',    0.8, 'RECURRING_COLLABORATOR', 0),
-- Frankel: Devil Wears Prada, Hope Springs = 2 films
('e_rec_frankel',   'AFFINITY', 'p_meryl', 'p_frankel',    0.8, 'RECURRING_COLLABORATOR', 0),
-- Soderbergh: Laundromat, Let Them All Talk = 2 films
('e_rec_soderbergh','AFFINITY', 'p_meryl', 'p_soderbergh', 0.7, 'RECURRING_COLLABORATOR', 0),
-- Amy Adams: Doubt + Julie & Julia = 2 films
('e_rec_adams',     'AFFINITY', 'p_meryl', 'p_streep_a',   0.8, 'RECURRING_COLLABORATOR', 0),
-- Marshall: Into the Woods + Mary Poppins Returns = 2 films
('e_rec_marshall',  'AFFINITY', 'p_meryl', 'p_marshall_r', 0.7, 'RECURRING_COLLABORATOR', 0);

-- ============================================================================
-- EDGES: PRECEDED_BY (Film → Film, the chronological spine)
-- SEQUENCE edges for the timeline animation path
-- Only the major career films — not every single one
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed, sequence_order) VALUES
('e_seq_1',  'SEQUENCE', 'f_julia',         'f_deer_hunter',   0.9, 'PRECEDED_BY', 1, 1),
('e_seq_2',  'SEQUENCE', 'f_deer_hunter',   'f_kramer',        1.0, 'PRECEDED_BY', 1, 2),
('e_seq_3',  'SEQUENCE', 'f_kramer',        'f_sophies',       1.0, 'PRECEDED_BY', 1, 3),
('e_seq_4',  'SEQUENCE', 'f_sophies',       'f_silkwood',      0.9, 'PRECEDED_BY', 1, 4),
('e_seq_5',  'SEQUENCE', 'f_silkwood',      'f_out_of_africa', 0.9, 'PRECEDED_BY', 1, 5),
('e_seq_6',  'SEQUENCE', 'f_out_of_africa', 'f_postcards',     0.8, 'PRECEDED_BY', 1, 6),
('e_seq_7',  'SEQUENCE', 'f_postcards',     'f_bridges',       0.9, 'PRECEDED_BY', 1, 7),
('e_seq_8',  'SEQUENCE', 'f_bridges',       'f_hours',         0.8, 'PRECEDED_BY', 1, 8),
('e_seq_9',  'SEQUENCE', 'f_hours',         'f_adaptation',    0.8, 'PRECEDED_BY', 1, 9),
('e_seq_10', 'SEQUENCE', 'f_adaptation',    'f_prada',         0.9, 'PRECEDED_BY', 1, 10),
('e_seq_11', 'SEQUENCE', 'f_prada',         'f_mamma_mia',     0.9, 'PRECEDED_BY', 1, 11),
('e_seq_12', 'SEQUENCE', 'f_mamma_mia',     'f_doubt',         0.8, 'PRECEDED_BY', 1, 12),
('e_seq_13', 'SEQUENCE', 'f_doubt',         'f_iron_lady',     0.9, 'PRECEDED_BY', 1, 13),
('e_seq_14', 'SEQUENCE', 'f_iron_lady',     'f_osage',         0.8, 'PRECEDED_BY', 1, 14),
('e_seq_15', 'SEQUENCE', 'f_osage',         'f_the_post',      0.8, 'PRECEDED_BY', 1, 15),
('e_seq_16', 'SEQUENCE', 'f_the_post',      'f_little_women',  0.8, 'PRECEDED_BY', 1, 16),
('e_seq_17', 'SEQUENCE', 'f_little_women',  'f_dont_look_up',  0.7, 'PRECEDED_BY', 1, 17);

-- ============================================================================
-- SETTINGS: Store dataset metadata
-- ============================================================================
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('demo_dataset',         'meryl_streep_career'),
  ('demo_dataset_version', '1.0'),
  ('demo_center_node',     'p_meryl'),
  ('demo_timeline_start',  '1977'),
  ('demo_timeline_end',    '2023'),
  ('demo_inflection_count','9'),
  ('demo_description',     'Meryl Streep career biography as a polymorphic LATCH × GRAPH dataset. 47 films, 21 Oscar nominations, 3 wins, 9 inflection moments. Suitable for Timeline, Network, SuperGrid, and Rosling Motion views.');
