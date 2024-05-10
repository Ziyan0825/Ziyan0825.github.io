---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% if site.author.googlescholar %}
  <div class="wordwrap">You can also find my articles on <a href="{{site.author.googlescholar}}">my Google Scholar profile</a>.</div>
{% endif %}

{% include base_path %}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}

- [Google Scholar](https://scholar.google.com/citations?hl=zh-CN&user=LcGjR5IAAAAJ)

## Journal Papers
Wu, Z., Zhang, W., Tang, R., Wang, H. & Korolija, I. Reinforcement learning in building controls: A comparative study of algorithms considering model availability and policy representation. J. Build. Eng. 109497 (2024).
