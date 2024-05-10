# ethereum-eips

Look up Ethereum Proposals and read them in Raycast.

```sh
gh repo clone banteg/raycast-eips
cd raycast-eips
npm install
npm run build  # or `npm run dev` if you want to change it
```

Then type "import extension" into Raycast.

The extension works off a local folder with these two repos.

```sh
gh repo clone ethereum/EIPs
gh repo clone ethereum/ERCs
```

The current repo will clone them automatically and then will update them once a day.
