export async function SearchPlayers (searchTerm)
{
    const response = await supabase.from('tbl_players').select('*').or(`username.ilike.%${searchTerm}%, firstName.ilike.%${searchTerm}%, lastName.ilike.%${searchTerm}%, nickname.ilike.%${searchTerm}%`).limit(4);
    return response.data;
}