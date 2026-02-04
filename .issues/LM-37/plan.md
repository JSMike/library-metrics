# Plan

1. Review existing GitLab sync flow for member and group data availability.
2. Design schema additions for project members + group SAML links (snapshot vs current).
3. Implement sync changes to fetch members and group SAML links with access level filtering.
4. Add any necessary DB migrations and update downstream reporting as needed.
