---
title: "CardBoard Glossary"
id: 133040
created: 2025-08-03T17:38:52Z
modified: 2025-08-19T15:10:39Z
folder: "Learning/CardBoard"
attachments:
  - id: "700d20eb-eb66-4080-9714-fecb797dabdd"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td><b>Sort</b></td><td><b>Category</b></td><td><b>Term</b></td><td><b>Definition</b></td></tr>\n<tr><td>1</td><td>Views</td><td>CardBoard</td><td>CardBoard View is the primary view in the app, a combination Kanban and SuperGrid.  CardBoard not only organizes work by stages but more generally organizes lists by categories in dimensions  within in a multidimensional spreadsheet (rows, columns, and filters) initiallly supporting basic calculations (subtotals, summary totals)</td></tr>\n<tr><td>2</td><td>Views</td><td>Cards</td><td>Cards are notes/tasks with Title, Properties, and Content and are present in all views as the primary user interface for surfacing insights from data sets</td></tr>\n<tr><td>3</td><td>Views</td><td>Calendar</td><td>Time-based views of cards as calendars/timelines from Apple Calendars, especially Daily and WeekMap (Timestamp and time series data parsing is key here)</td></tr>\n<tr><td>4</td><td>Views</td><td>Graph</td><td>Connected view of cards (with ability to add/edit connections)</td></tr>\n<tr><td>5</td><td>Views</td><td>People</td><td>Kanban View of Apple Contacts cards (CRM light)</td></tr>\n<tr><td>6</td><td>Elements</td><td>Command bar</td><td>Primary user interface element for keyboard-first app actions, including AI interactions (app terminal, can pop-out/access from command line as well)</td></tr>\n<tr><td>7</td><td>Elements</td><td>Categories</td><td>Categories are groups of properties organized by similarity or relatedness in context:\n<ul>\n<li>Alphanumeric: reference</li>\n<li>Time: chronology</li>\n<li>Location: place</li>\n<li>Category: relatedness</li>\n<li>Continuum: magnitude</li>\n</ul></td></tr>\n<tr><td>8</td><td>Elements</td><td>Dimensions</td><td>Dynamic categories are organized spatially: row, columms, filters, options, and available (part of the model, but not shown in the SuperGrid)</td></tr>\n<tr><td>9</td><td>Elements</td><td>Data cells</td><td>Spreadsheet cells with card/property and calculated values</td></tr>\n<tr><td>10</td><td>Elements</td><td>Inspector</td><td>Panel for user-configurable settings such as dimensions, formats, views, and calculations</td></tr>\n<tr><td>11</td><td>Elements</td><td>Events</td><td>Time-based actions: meetings, tasks, time-blocks, sequences, goals, and deadlines</td></tr>\n<tr><td>12</td><td>Elements</td><td>HAPT Ontology</td><td>Horizons, Areas, Projects, and Themes organized into views</td></tr>\n<tr><td>13</td><td>Elements</td><td>Links</td><td>Links between Cards and other Cards and URLs (many-to-many)</td></tr>\n<tr><td>14</td><td>Elements</td><td>Versions</td><td>Cards and models are versioned and can be backed up and recovered by TimeMachine</td></tr>\n<tr><td>15</td><td>Elements</td><td>Tasks</td><td>Get stuff done with maximal intentionality of action</td></tr>\n<tr><td>16</td><td>Elements</td><td>Archive</td><td>Archive is the universal historical versioned retention state for Cardboard and by default, search scope includes Archive only if explicitly specified</td></tr>\n<tr><td>17</td><td>Elements</td><td>Capture</td><td>Capture is the universal inbox state for CardBoard</td></tr>\n<tr><td>18</td><td>Elements</td><td>Card Titles</td><td>Card Titles (first header line) are also file names</td></tr>\n<tr><td>19</td><td>Elements</td><td>Card Properties</td><td>Card metadata (also frontmatter/database columns) includes dates, tags, links, and other additional extensible attributes</td></tr>\n<tr><td>20</td><td>Elements</td><td>Card Contents</td><td>Card content includes rich text, attachments, and rich previews of Cards</td></tr>\n<tr><td>21</td><td>Technologies</td><td>.cardboard file format</td><td>JSON-based state, metadata, and data file format with specification and documentation</td></tr>\n<tr><td>22</td><td>Technologies</td><td>.CSV file format</td><td>Comma-separated values file format for Boards and Cards (user-specified)</td></tr>\n<tr><td>23</td><td>Technologies</td><td>.HTML file format</td><td>HyperText Markup Language import format for Cards</td></tr>\n<tr><td>24</td><td>Technologies</td><td>.MD file format</td><td>MarkDown import format for Cards</td></tr>\n<tr><td>25</td><td>Technologies</td><td>.RTF file format</td><td>Rich Text File import format for Cards</td></tr>\n<tr><td>26</td><td>Technologies</td><td>CloudKit</td><td>iCloud-hosted SQLite database with multi-device sync</td></tr>\n<tr><td>27</td><td>Technologies</td><td>JSON file format</td><td>Javascript Object Notation</td></tr>\n<tr><td>28</td><td>Apps</td><td>alto.computer.app</td><td>alto.computer exports Apple Notes to HTML files—with a key limitation that it does not export files or tags</td></tr>\n<tr><td>29</td><td>Apps</td><td>alto.index.app</td><td>alto.index exports Apple Notes and other Personal Semantic Index data (Notes, Reminders, etc) to MD files—with a key limitation that it does not export attachments, files, or tags</td></tr>\n<tr><td>30</td><td>Apps</td><td>Apple Contacts.app</td><td>Native Apple contact management app</td></tr>\n<tr><td>31</td><td>Apps</td><td>Apple Mail.app</td><td>Native Apple email app</td></tr>\n<tr><td>32</td><td>Apps</td><td>Apple Messages.app</td><td>Native Apple messaging/SMS app</td></tr>\n<tr><td>33</td><td>Apps</td><td>Apple Notes.app</td><td>Native Apple note-taking app</td></tr>\n<tr><td>34</td><td>Apps</td><td>Apple Reminders.app</td><td>Native Apple task management app</td></tr>\n<tr><td>35</td><td>Apps</td><td>Books.app/Kindle.app</td><td>Book reading apps which will be the integration point for my Readlist</td></tr>\n<tr><td>36</td><td>Apps</td><td><a href=\"http://Coda.io\" class=\"link\" ><u>Coda.io</u></a></td><td>Admirable super-app, but does not work offline—no interoperability beyond CSV is expected</td></tr>\n<tr><td>37</td><td>Apps</td><td>Exporter.app</td><td>Exporter.app exports Apple Notes to either HTML or MD files—with a key limitation that it does not export files or tags</td></tr>\n<tr><td>38</td><td>Apps</td><td>HotNotes.app</td><td>Fast fuzzy search for Apple Notes</td></tr>\n<tr><td>39</td><td>Apps</td><td>letterboxd.app</td><td>Letterboxd is the cinema lovers website and will be the integration point for my Watchlist</td></tr>\n<tr><td>40</td><td>Apps</td><td>Lotus Improv</td><td>The original dynamic multidimensional spreadsheet that inspired all of this</td></tr>\n<tr><td>41</td><td>Apps</td><td>NotePlan.app</td><td>Markdown-based planner (lacks more sophisticated kanban and other views)</td></tr>\n<tr><td>42</td><td>Apps</td><td><a href=\"http://Notion.so\" class=\"link\" ><u>Notion.so</u></a></td><td>Admirable super-app, but does not work offline—no interoperability beyond CSV is expected</td></tr>\n<tr><td>43</td><td>Apps</td><td>Readwise.app</td><td>Readwise is a read-later app to be replaced with CardBoard Readlist</td></tr>\n<tr><td>44</td><td>Apps</td><td>RSS/Read-later</td><td>Really Simple Syndication enables accessing websites in a directed manner, and read-later means timeshifting capture and consumption for potential action</td></tr>\n<tr><td>45</td><td>Apps</td><td>Slack.app</td><td>Corporate collaboration app as source of tasks</td></tr>\n<tr><td>46</td><td>Extensions</td><td>Web clipper</td><td>Browser extension (Safari and Chrome) enabling capture of web pages (SingleFile -&gt; HTML import?)</td></tr>\n</table>\n"
  - id: "34659e2b-cb3a-4432-a0a8-187d08239184"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: "<a class=\"tag link\" href=\"/tags/IKE25\">#IKE25</a>"
links: []
source: notes://showNote?identifier=1233f5e9-0e9d-435f-8c82-2a9df003e9ff
---
CardBoard Glossary

| **Sort** | **Category** | **Term** | **Definition** |

|---|---|---|---|

| 1 | Views | CardBoard | CardBoard View is the primary view in the app, a combination Kanban and SuperGrid.  CardBoard not only organizes work by stages but more generally organizes lists by categories in dimensions  within in a multidimensional spreadsheet (rows, columns, and filters) initiallly supporting basic calculations (subtotals, summary totals) |

| 2 | Views | Cards | Cards are notes/tasks with Title, Properties, and Content and are present in all views as the primary user interface for surfacing insights from data sets |

| 3 | Views | Calendar | Time-based views of cards as calendars/timelines from Apple Calendars, especially Daily and WeekMap (Timestamp and time series data parsing is key here) |

| 4 | Views | Graph | Connected view of cards (with ability to add/edit connections) |

| 5 | Views | People | Kanban View of Apple Contacts cards (CRM light) |

| 6 | Elements | Command bar | Primary user interface element for keyboard-first app actions, including AI interactions (app terminal, can pop-out/access from command line as well) |

| 7 | Elements | Categories | Categories are groups of properties organized by similarity or relatedness in context:    Alphanumeric: referenceTime: chronologyLocation: placeCategory: relatednessContinuum: magnitude |

| 8 | Elements | Dimensions | Dynamic categories are organized spatially: row, columms, filters, options, and available (part of the model, but not shown in the SuperGrid) |

| 9 | Elements | Data cells | Spreadsheet cells with card/property and calculated values |

| 10 | Elements | Inspector | Panel for user-configurable settings such as dimensions, formats, views, and calculations |

| 11 | Elements | Events | Time-based actions: meetings, tasks, time-blocks, sequences, goals, and deadlines |

| 12 | Elements | HAPT Ontology | Horizons, Areas, Projects, and Themes organized into views |

| 13 | Elements | Links | Links between Cards and other Cards and URLs (many-to-many) |

| 14 | Elements | Versions | Cards and models are versioned and can be backed up and recovered by TimeMachine |

| 15 | Elements | Tasks | Get stuff done with maximal intentionality of action |

| 16 | Elements | Archive | Archive is the universal historical versioned retention state for Cardboard and by default, search scope includes Archive only if explicitly specified |

| 17 | Elements | Capture | Capture is the universal inbox state for CardBoard |

| 18 | Elements | Card Titles | Card Titles (first header line) are also file names |

| 19 | Elements | Card Properties | Card metadata (also frontmatter/database columns) includes dates, tags, links, and other additional extensible attributes |

| 20 | Elements | Card Contents | Card content includes rich text, attachments, and rich previews of Cards |

| 21 | Technologies | .cardboard file format | JSON-based state, metadata, and data file format with specification and documentation |

| 22 | Technologies | .CSV file format | Comma-separated values file format for Boards and Cards (user-specified) |

| 23 | Technologies | .HTML file format | HyperText Markup Language import format for Cards |

| 24 | Technologies | .MD file format | MarkDown import format for Cards |

| 25 | Technologies | .RTF file format | Rich Text File import format for Cards |

| 26 | Technologies | CloudKit | iCloud-hosted SQLite database with multi-device sync |

| 27 | Technologies | JSON file format | Javascript Object Notation |

| 28 | Apps | alto.computer.app | alto.computer exports Apple Notes to HTML files—with a key limitation that it does not export files or tags |

| 29 | Apps | alto.index.app | alto.index exports Apple Notes and other Personal Semantic Index data (Notes, Reminders, etc) to MD files—with a key limitation that it does not export attachments, files, or tags |

| 30 | Apps | Apple Contacts.app | Native Apple contact management app |

| 31 | Apps | Apple Mail.app | Native Apple email app |

| 32 | Apps | Apple Messages.app | Native Apple messaging/SMS app |

| 33 | Apps | Apple Notes.app | Native Apple note-taking app |

| 34 | Apps | Apple Reminders.app | Native Apple task management app |

| 35 | Apps | Books.app/Kindle.app | Book reading apps which will be the integration point for my Readlist |

| 36 | Apps | Coda.io | Admirable super-app, but does not work offline—no interoperability beyond CSV is expected |

| 37 | Apps | Exporter.app | Exporter.app exports Apple Notes to either HTML or MD files—with a key limitation that it does not export files or tags |

| 38 | Apps | HotNotes.app | Fast fuzzy search for Apple Notes |

| 39 | Apps | letterboxd.app | Letterboxd is the cinema lovers website and will be the integration point for my Watchlist |

| 40 | Apps | Lotus Improv | The original dynamic multidimensional spreadsheet that inspired all of this |

| 41 | Apps | NotePlan.app | Markdown-based planner (lacks more sophisticated kanban and other views) |

| 42 | Apps | Notion.so | Admirable super-app, but does not work offline—no interoperability beyond CSV is expected |

| 43 | Apps | Readwise.app | Readwise is a read-later app to be replaced with CardBoard Readlist |

| 44 | Apps | RSS/Read-later | Really Simple Syndication enables accessing websites in a directed manner, and read-later means timeshifting capture and consumption for potential action |

| 45 | Apps | Slack.app | Corporate collaboration app as source of tasks |

| 46 | Extensions | Web clipper | Browser extension (Safari and Chrome) enabling capture of web pages (SingleFile -> HTML import?) |

[#IKE25](/tags/IKE25)

---

[Open in Notes](notes://showNote?identifier=1233f5e9-0e9d-435f-8c82-2a9df003e9ff)