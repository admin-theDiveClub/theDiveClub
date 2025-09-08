function OutputResponse(response) 
{
    if (response.error) 
    {
        console.error('Error:', response.error);
    } else 
    {
        console.log('Success:', response.data);
    }
}

export async function DB_Update(tbl, data, id) 
{
    const response = await supabase
    .from(tbl)
    .update(data)
    .eq('id', id)
    .select();

    OutputResponse(response);
    return response;
}
