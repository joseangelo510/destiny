# Reviews registry state and recovery

Saving or removing a public profile must update the saved-URL count and guided-step completion in the current page without a reload. The count uses singular grammar for one URL. A connected Google Business Profile also satisfies the guided step even when no public profile URL is saved.

Save, Check and Remove must clear busy state after a rejected fetch or non-JSON response, show an actionable retry message, and preserve the input and prior profile. A successful retry performs the intended transition. Structured API errors retain their server-provided message.

Browser coverage exercises the count/completion transition plus all three operations across rejected-network and HTML 502 failures on desktop and mobile. Requests use the disposable authenticated website and intercepted directory responses; no production profile is changed. No endpoint, billing, authentication, schema or provider-connection behavior changes.
